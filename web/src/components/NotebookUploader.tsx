"use client";

import React, { useState, useRef } from "react";
import { upload } from "@vercel/blob/client";
import {
  formatBytes,
  formatDate,
  sanitizeFileName,
  submissionPrefix,
  validateNotebookFile,
  type NotebookSubmissionData,
} from "@/lib/classes-shared";
import { SubmissionFeedbackCard } from "./SubmissionFeedbackCard";

export interface NotebookUploaderProps {
  classSlug: string;
  lessonSlug: string;
  assignmentId: string;
  userId: string;
  initialSubmission?: NotebookSubmissionData | null;
  maxScore?: number;
  renderedFeedbackHtml?: string | null;
  submissionsUnavailable?: boolean;
  onSubmitted?: (submission: NotebookSubmissionData) => void;
}

/** Identity of a picked file. Re-picking the same file creates a new `File` object,
 * so object identity would force a second upload (and an orphaned blob) on retry. */
function fileKey(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export function NotebookUploader({
  classSlug,
  lessonSlug,
  assignmentId,
  userId,
  initialSubmission,
  maxScore,
  renderedFeedbackHtml,
  submissionsUnavailable = false,
  onSubmitted,
}: NotebookUploaderProps) {
  const [submission, setSubmission] = useState<NotebookSubmissionData | null>(
    initialSubmission ?? null,
  );
  const [isUnavailable, setIsUnavailable] = useState(submissionsUnavailable);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [stagedBlob, setStagedBlob] = useState<{
    url: string;
    fileName: string;
    fileBytes: number;
    key: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Single-submission lock: once committed, no second upload is permitted
  const isLocked = submission !== null;

  function validateFile(file: File): string | null {
    const res = validateNotebookFile(file.name, file.size);
    return res.valid ? null : (res.error ?? "Invalid file");
  }

  function handleFileSelected(file: File) {
    setError(null);
    const validationError = validateFile(file);
    if (validationError) {
      setSelectedFile(null);
      setStagedBlob(null);
      setError(validationError);
      return;
    }
    setSelectedFile(file);
    // A different file invalidates the staged upload; the same file keeps it, so a
    // retry after a failed save commits the blob already uploaded.
    setStagedBlob((prev) => (prev && prev.key === fileKey(file) ? prev : null));
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!uploading && !isLocked && !isUnavailable) {
      setIsDragOver(true);
    }
  }

  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    if (uploading || isLocked || isUnavailable) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  }

  async function fetchExistingSubmission(): Promise<{
    submission: NotebookSubmissionData | null;
    unavailable?: boolean;
    forbidden?: boolean;
    status?: number;
  }> {
    try {
      const res = await fetch(`/api/classes/${classSlug}/lessons/${lessonSlug}/submissions`);
      if (res.status === 503) {
        return { submission: null, unavailable: true, status: 503 };
      }
      if (res.status === 403) {
        return { submission: null, forbidden: true, status: 403 };
      }
      if (res.ok) {
        const data = await res.json();
        if (data.unavailable) {
          return { submission: null, unavailable: true, status: 503 };
        }
        const found = data.submissions?.find(
          (s: NotebookSubmissionData) => s.assignmentId === assignmentId,
        );
        if (found) {
          return {
            submission: {
              ...found,
              submittedAt:
                typeof found.submittedAt === "string"
                  ? found.submittedAt
                  : new Date(found.submittedAt).toISOString(),
              gradedAt: found.gradedAt
                ? typeof found.gradedAt === "string"
                  ? found.gradedAt
                  : new Date(found.gradedAt).toISOString()
                : null,
            },
            status: 200,
          };
        }
        return { submission: null, status: 200 };
      }
    } catch {}
    return { submission: null };
  }

  async function handleSubmit() {
    if (!selectedFile || uploading || isLocked || isUnavailable) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Pre-check existing submission before uploading
      const preCheck = await fetchExistingSubmission().catch(() => null);
      if (preCheck?.submission) {
        setSubmission(preCheck.submission);
        setSelectedFile(null);
        setStagedBlob(null);
        if (onSubmitted) onSubmitted(preCheck.submission);
        setUploading(false);
        return;
      }
      if (preCheck?.unavailable) {
        setIsUnavailable(true);
        setError("Notebook submissions are currently unavailable on this deployment.");
        setUploading(false);
        return;
      }
      if (preCheck?.forbidden) {
        setError("Instructors cannot submit homework.");
        setUploading(false);
        return;
      }

      let blobUrl =
        stagedBlob && stagedBlob.key === fileKey(selectedFile) ? stagedBlob.url : null;
      let blobFileName = selectedFile.name;
      let blobFileBytes = selectedFile.size;

      // 1. Direct client-to-blob upload if not already staged
      if (!blobUrl) {
        const cleanFileName = sanitizeFileName(selectedFile.name);
        const prefix = submissionPrefix(classSlug, lessonSlug, userId, assignmentId);
        const targetPath = `${prefix}${cleanFileName}`;

        const blobResult = await upload(targetPath, selectedFile, {
          access: "private",
          handleUploadUrl: "/api/blob/upload-submission-token",
          clientPayload: JSON.stringify({
            classSlug,
            lessonSlug,
            assignmentId,
          }),
          onUploadProgress: (p) => {
            setProgress(p.percentage);
          },
        });

        blobUrl = blobResult.url;
        setStagedBlob({
          url: blobUrl,
          fileName: selectedFile.name,
          fileBytes: selectedFile.size,
          key: fileKey(selectedFile),
        });
      }

      // 2. Commit submission to PostgreSQL database
      const res = await fetch(
        `/api/classes/${classSlug}/lessons/${lessonSlug}/submissions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId,
            fileUrl: blobUrl,
            fileName: blobFileName,
            fileBytes: blobFileBytes,
          }),
        },
      );

      if (res.status === 409) {
        const check = await fetchExistingSubmission().catch(() => null);
        if (check?.submission) {
          setSubmission(check.submission);
          setSelectedFile(null);
          setStagedBlob(null);
          setError(null);
          if (onSubmitted) onSubmitted(check.submission);
          return;
        }
        throw new Error("This assignment has already been submitted.");
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to record submission (HTTP ${res.status})`,
        );
      }

      const data = await res.json();
      const newSubmission: NotebookSubmissionData = {
        ...data.submission,
        submittedAt:
          typeof data.submission.submittedAt === "string"
            ? data.submission.submittedAt
            : new Date(data.submission.submittedAt).toISOString(),
        gradedAt: data.submission.gradedAt
          ? typeof data.submission.gradedAt === "string"
            ? data.submission.gradedAt
            : new Date(data.submission.gradedAt).toISOString()
          : null,
      };

      setSubmission(newSubmission);
      setSelectedFile(null);
      setStagedBlob(null);
      if (onSubmitted) {
        onSubmitted(newSubmission);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Vercel Blob client hides token 409/403/503 behind BlobError("Failed to retrieve the client token").
      // Check whether a submission already exists or if submissions are unavailable.
      const check = await fetchExistingSubmission().catch(() => null);
      if (check?.submission) {
        setSubmission(check.submission);
        setSelectedFile(null);
        setStagedBlob(null);
        setError(null);
        if (onSubmitted) onSubmitted(check.submission);
        return;
      }
      if (check?.unavailable) {
        setIsUnavailable(true);
        setError("Notebook submissions are currently unavailable on this deployment (database table missing).");
        return;
      }
      if (check?.forbidden) {
        setError("You do not have permission to submit homework for this class.");
        return;
      }
      if (msg.includes("Failed to retrieve the client token")) {
        setError("Upload failed. If you already submitted or lack enrollment permissions, please check your status.");
      } else {
        setError(msg);
      }
    } finally {
      setUploading(false);
    }
  }

  if (isUnavailable) {
    return (
      <div className="notebook-notice muted" data-testid="uploader-unavailable">
        ⚠️ Notebook submissions are currently unavailable on this deployment.
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="notebook-uploader-locked" data-testid="notebook-uploader-locked">
        <SubmissionFeedbackCard
          submission={submission}
          maxScore={maxScore}
          classSlug={classSlug}
          lessonSlug={lessonSlug}
          renderedFeedbackHtml={renderedFeedbackHtml}
        />
        <p className="notebook-lock-notice muted" data-testid="lock-notice">
          🔒 Single submission policy: This assignment is locked. No further submissions are accepted.
        </p>
      </div>
    );
  }

  return (
    <div className="notebook-uploader-container" data-testid="notebook-uploader">
      <div
        className={`notebook-dropzone ${isDragOver ? "dragover" : ""} ${
          selectedFile ? "has-file" : ""
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        data-testid="notebook-dropzone"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileInputChange}
          accept=".ipynb,application/x-ipynb+json"
          style={{ display: "none" }}
          data-testid="notebook-file-input"
        />

        {selectedFile ? (
          <div className="notebook-dropzone-selected">
            <span className="notebook-file-icon">📓</span>
            <div className="notebook-file-info">
              <span className="notebook-file-title" data-testid="selected-file-name">
                {selectedFile.name}
              </span>
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                {formatBytes(selectedFile.size)} · Click or drop another file to change
              </span>
            </div>
          </div>
        ) : (
          <div className="notebook-dropzone-empty">
            <span className="notebook-file-icon">📤</span>
            <p className="notebook-dropzone-label">
              Drag and drop your completed <code>.ipynb</code> notebook here, or{" "}
              <span className="notebook-browse-btn">browse</span>
            </p>
            <span className="muted" style={{ fontSize: "0.78rem" }}>
              Jupyter Notebook (.ipynb) only · Up to 25 MB
            </span>
          </div>
        )}
      </div>

      {uploading && (
        <div className="notebook-upload-progress" data-testid="upload-progress">
          <div className="notebook-progress-bar">
            <div
              className="notebook-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="notebook-progress-meta">
            <span className="muted">Uploading solution to private store…</span>
            <span className="notebook-progress-pct">{Math.round(progress)}%</span>
          </div>
        </div>
      )}

      {error && (
        <div className="sub-modal-error" data-testid="upload-error" style={{ marginTop: "0.75rem" }}>
          {error}
        </div>
      )}

      {selectedFile && !uploading && (
        <div className="notebook-uploader-actions" style={{ marginTop: "0.75rem" }}>
          <button
            type="button"
            className="bt-login-btn notebook-submit-btn"
            onClick={handleSubmit}
            disabled={uploading}
            data-testid="submit-notebook-btn"
          >
            Submit Notebook (.ipynb)
          </button>
          <button
            type="button"
            className="bt-clear-btn"
            onClick={() => {
              setSelectedFile(null);
              setStagedBlob(null);
              setError(null);
            }}
            data-testid="clear-notebook-btn"
            disabled={uploading}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
