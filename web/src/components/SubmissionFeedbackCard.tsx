import React from "react";
import {
  effectiveMaxScore,
  formatBytes,
  formatDate,
  type NotebookSubmissionData,
} from "@/lib/classes-shared";

export interface SubmissionFeedbackCardProps {
  submission: NotebookSubmissionData;
  maxScore?: number;
  classSlug?: string;
  lessonSlug?: string;
  renderedFeedbackHtml?: string | null;
  showDownloadLink?: boolean;
}

export function SubmissionFeedbackCard({
  submission,
  maxScore,
  classSlug,
  lessonSlug,
  renderedFeedbackHtml,
  showDownloadLink = true,
}: SubmissionFeedbackCardProps) {
  const isGraded = submission.status === "graded" && submission.grade !== null;
  const resolvedMax = effectiveMaxScore(maxScore, submission.maxGrade);
  const html = renderedFeedbackHtml ?? null;

  const downloadUrl =
    classSlug && lessonSlug
      ? `/api/classes/${classSlug}/lessons/${lessonSlug}/submissions/${submission.id}/download`
      : null;

  return (
    <div className="notebook-feedback-box" data-testid="submission-feedback-card">
      <div className="notebook-feedback-header">
        <div className="notebook-feedback-status">
          {isGraded ? (
            <span className="badge easy" data-testid="grade-badge">
              Graded · {submission.grade} / {resolvedMax} pts
            </span>
          ) : (
            <span className="badge medium" data-testid="status-badge">
              Submitted · Awaiting Review
            </span>
          )}
        </div>
        <div className="notebook-feedback-meta muted">
          {isGraded ? (
            <span>
              Graded by {submission.gradedBy ?? "Instructor"} on {formatDate(submission.gradedAt)}
            </span>
          ) : (
            <span>Submitted on {formatDate(submission.submittedAt)}</span>
          )}
        </div>
      </div>

      {showDownloadLink && (
        <div className="notebook-file-box">
          <div className="notebook-file-details">
            <span className="notebook-file-name" title={submission.fileName}>
              {submission.fileName}
            </span>
            <span className="notebook-file-meta muted">
              {formatBytes(submission.fileBytes)} · Submitted on {formatDate(submission.submittedAt)}
            </span>
          </div>
          {downloadUrl && (
            <a
              href={downloadUrl}
              download={submission.fileName}
              className="bt-clear-btn notebook-download-btn"
              data-testid="download-submission-link"
            >
              Download .ipynb
            </a>
          )}
        </div>
      )}

      {isGraded && (
        <div className="notebook-feedback-body">
          <h4 className="notebook-feedback-title">Instructor Feedback</h4>
          {html ? (
            <div
              className="feedback-markdown-content"
              data-testid="feedback-content"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : submission.feedback ? (
            <div
              className="feedback-markdown-content"
              data-testid="feedback-content"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {submission.feedback}
            </div>
          ) : (
            <p className="muted" style={{ fontStyle: "italic", margin: 0 }}>
              No written feedback provided.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
