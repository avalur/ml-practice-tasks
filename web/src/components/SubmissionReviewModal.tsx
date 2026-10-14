"use client";

import { useEffect, useState, useId, useRef } from "react";
import { renderFeedbackMarkdown } from "@/lib/feedback-render";

export type SubmissionModalData = {
  id: string;
  userId: string;
  classId: string;
  lessonSlug: string;
  assignmentId: string;
  fileUrl: string;
  fileName: string;
  fileBytes: number;
  submittedAt: string | Date;
  status: string; // "submitted" | "graded"
  grade: number | null;
  maxGrade: number | null;
  feedback: string | null;
  gradedBy: string | null;
  gradedAt: string | Date | null;
};

export type StudentModalInfo = {
  id: string;
  name: string | null;
  email: string | null;
  group?: { code: string; label: string } | null;
};

export type AssignmentModalInfo = {
  id: string;
  title: string;
  maxScore?: number;
};

interface SubmissionReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: SubmissionModalData | null;
  student: StudentModalInfo | null;
  assignment: AssignmentModalInfo | null;
  classSlug: string;
  lessonSlug: string;
  onGradeSaved: (savedSubmission: SubmissionModalData) => void;
  onGradeRollback?: (previousSubmission: SubmissionModalData) => void;
  teacherEmail?: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(d: string | Date): string {
  try {
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(d);
  }
}

export function SubmissionReviewModal({
  isOpen,
  onClose,
  submission,
  student,
  assignment,
  classSlug,
  lessonSlug,
  onGradeSaved,
  onGradeRollback,
  teacherEmail,
}: SubmissionReviewModalProps) {
  // Authoritative maxScore comes from the assignment definition, defaulting to 100
  const maxGrade = assignment?.maxScore ?? 100;

  const [gradeInput, setGradeInput] = useState<string>("");
  const [feedbackInput, setFeedbackInput] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const titleId = useId();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const gradeInputRef = useRef<HTMLInputElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const saveReqTokenRef = useRef(0);

  // Initialize form state ONLY when opened or when target submission/student/assignment changes
  const lastTargetKeyRef = useRef<string>("");
  const targetKey =
    isOpen && student && assignment
      ? `${student.id}:${assignment.id}:${submission?.id ?? "none"}`
      : "";

  useEffect(() => {
    if (isOpen) {
      if (lastTargetKeyRef.current !== targetKey) {
        lastTargetKeyRef.current = targetKey;
        setGradeInput(
          submission?.grade !== null && submission?.grade !== undefined
            ? String(submission.grade)
            : "",
        );
        setFeedbackInput(submission?.feedback ?? "");
        setActiveTab("write");
        savingRef.current = false;
        setSaving(false);
        setError(null);
      }
    } else {
      lastTargetKeyRef.current = "";
      savingRef.current = false;
      setSaving(false);
      setError(null);
    }
  }, [isOpen, targetKey, submission?.grade, submission?.feedback]);

  // Capture triggering element on open, return focus on close, and auto-focus first input
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      const timer = setTimeout(() => {
        if (submission && gradeInputRef.current) {
          gradeInputRef.current.focus();
        } else if (closeBtnRef.current) {
          closeBtnRef.current.focus();
        }
      }, 0);
      return () => clearTimeout(timer);
    } else {
      if (triggerRef.current) {
        triggerRef.current.focus();
        triggerRef.current = null;
      }
    }
  }, [isOpen, submission]);

  // Focus trap inside modal dialog and Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!saving) {
          onClose();
        }
        return;
      }

      if (e.key === "Tab" && cardRef.current) {
        const focusableElements = cardRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, saving, onClose]);

  if (!isOpen || !student || !assignment) return null;

  const studentDisplayName = student.name || student.email || "Student";

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (savingRef.current || saving) return; // Guard against concurrent saves
    if (!submission) return;

    const trimmedGrade = gradeInput.trim();
    if (!trimmedGrade) {
      setError("Please enter a grade score.");
      return;
    }

    const parsedGrade = parseInt(trimmedGrade, 10);
    if (isNaN(parsedGrade) || parsedGrade < 0 || parsedGrade > maxGrade) {
      setError(`Grade must be an integer between 0 and ${maxGrade}.`);
      return;
    }

    const trimmedFeedback = feedbackInput.trim();
    setError(null);
    savingRef.current = true;
    setSaving(true);
    const currentToken = ++saveReqTokenRef.current;

    const prevSubmission = { ...submission };
    const optimisticSubmission: SubmissionModalData = {
      ...submission,
      status: "graded",
      grade: parsedGrade,
      maxGrade,
      feedback: trimmedFeedback,
      gradedBy: teacherEmail || "You",
      gradedAt: new Date().toISOString(),
    };

    // Optimistically update matrix cell immediately
    onGradeSaved(optimisticSubmission);

    try {
      const res = await fetch(
        `/api/classes/${classSlug}/lessons/${lessonSlug}/submissions/${submission.id}/grade`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            grade: parsedGrade,
            maxGrade,
            feedback: trimmedFeedback,
          }),
        },
      );

      let data: { error?: string; submission?: SubmissionModalData } = {};
      try {
        data = await res.json();
      } catch {
        // Non-JSON response (e.g. 502/504 gateway or plain text error)
      }
      if (!res.ok) {
        throw new Error(data.error || `Failed to save grade (${res.status} ${res.statusText})`);
      }

      if (currentToken !== saveReqTokenRef.current) return;

      // Confirmed server state
      if (data.submission) {
        onGradeSaved(data.submission);
      }
      onClose();
    } catch (err: unknown) {
      if (currentToken !== saveReqTokenRef.current) return;

      // Rollback table cell state
      if (onGradeRollback) {
        onGradeRollback(prevSubmission);
      } else {
        onGradeSaved(prevSubmission);
      }

      // Preserve typed form input and display visible error
      const msg = err instanceof Error ? err.message : "Failed to save grade.";
      setError(msg);
    } finally {
      if (currentToken === saveReqTokenRef.current) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  }

  return (
    <div
      className="sub-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="sub-modal-card"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* Header */}
        <div className="sub-modal-header">
          <div>
            <h3 id={titleId}>{assignment.title}</h3>
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              Assignment review · {assignment.id}
            </span>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="sub-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="sub-modal-body">
          {/* Student metadata */}
          <div className="sub-modal-meta-grid">
            <div className="sub-modal-meta-item">
              <span className="sub-modal-meta-label">Student</span>
              <span className="sub-modal-meta-val">{studentDisplayName}</span>
              {student.name && student.email && (
                <span className="muted" style={{ fontSize: "0.78rem" }}>
                  {student.email}
                </span>
              )}
            </div>

            <div className="sub-modal-meta-item">
              <span className="sub-modal-meta-label">Cohort / Group</span>
              <span className="sub-modal-meta-val">
                {student.group?.label || student.group?.code || "No group"}
              </span>
            </div>

            <div className="sub-modal-meta-item">
              <span className="sub-modal-meta-label">Status</span>
              <div>
                {!submission ? (
                  <span className="badge hard">Not Submitted</span>
                ) : submission.status === "graded" ? (
                  <span className="badge easy">
                    Graded ({submission.grade} / {maxGrade})
                  </span>
                ) : (
                  <span className="badge medium">Submitted · Awaiting Review</span>
                )}
              </div>
            </div>

            {submission && (
              <div className="sub-modal-meta-item">
                <span className="sub-modal-meta-label">Submitted At</span>
                <span className="sub-modal-meta-val" style={{ fontSize: "0.82rem" }}>
                  {formatDate(submission.submittedAt)}
                </span>
              </div>
            )}
          </div>

          {/* Submission not present view */}
          {!submission ? (
            <div className="sub-modal-section">
              <p className="muted" style={{ margin: "0.5rem 0", fontSize: "0.92rem" }}>
                This student has not submitted a notebook for this assignment yet. Once the student
                uploads their <code>.ipynb</code> file, you will be able to download and grade it
                here.
              </p>
            </div>
          ) : (
            <>
              {/* Download box */}
              <div className="sub-modal-download-box">
                <div className="sub-modal-file-info">
                  <span className="sub-modal-file-name" title={submission.fileName}>
                    {submission.fileName}
                  </span>
                  <span className="sub-modal-file-size">
                    {formatBytes(submission.fileBytes)} · Jupyter Notebook (.ipynb)
                  </span>
                </div>
                <a
                  href={`/api/classes/${classSlug}/lessons/${lessonSlug}/submissions/${submission.id}/download`}
                  download={submission.fileName}
                  className="btn small primary"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="submission-download-btn"
                >
                  Download .ipynb
                </a>
              </div>

              {/* Teacher metadata (if already graded) */}
              {submission.gradedBy && (
                <div
                  className="muted"
                  style={{
                    fontSize: "0.8rem",
                    padding: "0.3rem 0.5rem",
                    background: "var(--panel-2)",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                  }}
                  data-testid="submission-grader-info"
                >
                  Graded by <strong>{submission.gradedBy}</strong>
                  {submission.gradedAt ? ` on ${formatDate(submission.gradedAt)}` : ""}
                </div>
              )}

              {/* Grading Form */}
              <form onSubmit={handleFormSubmit} id="submission-grade-form">
                <div className="sub-modal-section">
                  <div className="sub-modal-field">
                    <label htmlFor="grade-score-input">
                      <span>Score</span>
                      <span className="muted" style={{ fontWeight: 400 }}>
                        Maximum: {maxGrade} pts
                      </span>
                    </label>
                    <input
                      ref={gradeInputRef}
                      id="grade-score-input"
                      type="number"
                      min={0}
                      max={maxGrade}
                      step={1}
                      required
                      placeholder={`0 - ${maxGrade}`}
                      value={gradeInput}
                      onChange={(e) => setGradeInput(e.target.value)}
                      disabled={saving}
                      data-testid="submission-grade-input"
                    />
                  </div>

                  <div className="sub-modal-field" style={{ marginTop: "0.75rem" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <label htmlFor="grade-feedback-input" style={{ margin: 0 }}>
                        Teacher Feedback (Markdown)
                      </label>
                      <div
                        className="sub-modal-tabs"
                        role="tablist"
                        aria-label="Feedback editor tabs"
                      >
                        <button
                          type="button"
                          role="tab"
                          id="feedback-tab-write"
                          aria-selected={activeTab === "write"}
                          aria-controls="feedback-panel-write"
                          className={`sub-modal-tab-btn ${activeTab === "write" ? "active" : ""}`}
                          onClick={() => setActiveTab("write")}
                          data-testid="feedback-tab-write"
                        >
                          Write
                        </button>
                        <button
                          type="button"
                          role="tab"
                          id="feedback-tab-preview"
                          aria-selected={activeTab === "preview"}
                          aria-controls="feedback-panel-preview"
                          className={`sub-modal-tab-btn ${activeTab === "preview" ? "active" : ""}`}
                          onClick={() => setActiveTab("preview")}
                          data-testid="feedback-tab-preview"
                        >
                          Preview
                        </button>
                      </div>
                    </div>

                    {/* Both panels are kept mounted to keep label associations and typed values intact */}
                    <div
                      id="feedback-panel-write"
                      role="tabpanel"
                      aria-labelledby="feedback-tab-write"
                      style={{ display: activeTab === "write" ? "block" : "none" }}
                    >
                      <textarea
                        id="grade-feedback-input"
                        rows={5}
                        placeholder="Provide feedback on the notebook code, plots, and analysis (Markdown supported)..."
                        value={feedbackInput}
                        onChange={(e) => setFeedbackInput(e.target.value)}
                        disabled={saving}
                        data-testid="submission-feedback-input"
                      />
                    </div>
                    <div
                      id="feedback-panel-preview"
                      role="tabpanel"
                      aria-labelledby="feedback-tab-preview"
                      style={{ display: activeTab === "preview" ? "block" : "none" }}
                    >
                      <div
                        className="sub-modal-preview"
                        data-testid="submission-feedback-preview"
                        dangerouslySetInnerHTML={{
                          __html: feedbackInput.trim()
                            ? renderFeedbackMarkdown(feedbackInput)
                            : "<p class='muted'><em>No feedback entered yet.</em></p>",
                        }}
                      />
                    </div>
                  </div>

                  {error && (
                    <div
                      className="sub-modal-error"
                      role="alert"
                      style={{ marginTop: "0.75rem" }}
                      data-testid="submission-grade-error"
                    >
                      {error}
                    </div>
                  )}
                </div>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sub-modal-footer">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={saving}
            data-testid="submission-cancel-btn"
          >
            {submission ? "Cancel" : "Close"}
          </button>
          {submission && (
            <button
              type="submit"
              form="submission-grade-form"
              className="btn primary"
              disabled={saving}
              data-testid="submission-save-grade-btn"
            >
              {saving ? "Saving..." : submission.status === "graded" ? "Update Grade" : "Save Grade"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
