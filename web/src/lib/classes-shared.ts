export const MAX_SUBMISSION_BYTES = 25 * 1024 * 1024; // 25 MB

/** Authoritative maximum score: assignment definition in class.json wins,
 * falling back to submission.maxGrade, and defaulting to 100.
 */
export function effectiveMaxScore(
  assignmentMaxScore?: number | null,
  submissionMaxGrade?: number | null,
): number {
  return assignmentMaxScore ?? submissionMaxGrade ?? 100;
}

/** Pure validation for uploaded notebook files. Client- and server-safe. */
export function validateNotebookFile(
  fileName: string,
  fileBytes: number,
  maxBytes: number = MAX_SUBMISSION_BYTES,
): { valid: boolean; error?: string } {
  if (!fileName || !fileName.toLowerCase().endsWith(".ipynb")) {
    return { valid: false, error: "Only Jupyter Notebook (.ipynb) files are accepted." };
  }
  if (fileBytes <= 0) {
    return { valid: false, error: "File cannot be empty." };
  }
  if (fileBytes > maxBytes) {
    return {
      valid: false,
      error: `File size (${formatBytes(fileBytes)}) exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB limit.`,
    };
  }
  return { valid: true };
}

export type ContentRef = { type: "problem" | "notebook"; id: string };

export type AssignmentRef = {
  type: "assignment";
  id: string;
  title: string;
  templateHref?: string;
  maxScore?: number;
};

export type TrackableRef = ContentRef | AssignmentRef;

/** An `id` with a `*` in class.json, already expanded by export_decks.py. */
export type GroupRef = {
  type: "group";
  of: "problem" | "notebook";
  pattern: string;
  title: string;
  items: ContentRef[];
};

/** A practice item that lives outside the site — a Colab notebook, a dataset. */
export type LinkRef = { type: "link"; title: string; href: string };

/** Anything the site can count as done for a student. */
export type TrackedItem = ContentRef | GroupRef | AssignmentRef;

export type Item = TrackedItem | LinkRef;

export type Homework = { due: string; items: TrackedItem[] };

export type Lesson = {
  slug: string;
  title: string;
  date: string | null;
  deck: string;
  practice: Item[];
  homework: Homework | null;
};

export type ClassMeta = {
  slug: string;
  title: string;
  description: string;
  order: number;
  lessons: Lesson[];
};

export function isGroup(item: Item): item is GroupRef {
  return item.type === "group";
}

export function isLink(item: Item): item is LinkRef {
  return item.type === "link";
}

export function isAssignment(item: Item): item is AssignmentRef {
  return item.type === "assignment";
}

/** Flatten groups so counting and DB lookups only ever see real content/assignment refs. */
export function flatten(items: Item[]): TrackableRef[] {
  return items.flatMap((i) => (isGroup(i) ? i.items : isLink(i) ? [] : [i]));
}

export function findLesson(cls: ClassMeta, lessonSlug: string): Lesson | null {
  return cls.lessons.find((l) => l.slug === lessonSlug) ?? null;
}

/** Items shown in the focused-lesson homework matrix.
 *
 * Homework columns come first. Practice `assignment` items are merged in
 * afterwards, de-duplicated by id, so an in-class notebook is still
 * reviewable when the lesson also has a problem-set homework. If the lesson
 * has no homework block, the practice list is shown as-is (problems, links
 * and assignments).
 */
export function lessonMatrixItems(lesson: Pick<Lesson, "practice" | "homework">): Item[] {
  if (!lesson.homework) {
    return [...lesson.practice];
  }
  const items: Item[] = [...lesson.homework.items];
  const seenAssignmentIds = new Set(items.filter(isAssignment).map((a) => a.id));
  for (const p of lesson.practice) {
    if (isAssignment(p) && !seenAssignmentIds.has(p.id)) {
      items.push(p);
      seenAssignmentIds.add(p.id);
    }
  }
  return items;
}

export type SubmissionSummary = {
  status: string; // "submitted" | "graded"
  grade: number | null;
  maxGrade?: number | null;
};

export type AssignmentCellState = {
  status: "none" | "none-late" | "submitted" | "graded";
  label: string;
  title: string;
  cellClass: string;
  btnClass: string;
  isGraded: boolean;
  isSubmitted: boolean;
};

/** Compute cell display state for an assignment column.
 * Authoritative maxScore comes from the assignment definition, defaulting to 100.
 */
export function computeAssignmentCellState(params: {
  assignment: AssignmentRef;
  submission: SubmissionSummary | null;
  overdue: boolean;
}): AssignmentCellState {
  const { assignment, submission, overdue } = params;
  const maxScore = assignment.maxScore ?? 100;
  const isGraded = submission?.status === "graded" && submission.grade !== null;
  const isSubmitted = submission?.status === "submitted" || (submission !== null && !isGraded);

  if (isGraded && submission) {
    const grade = submission.grade;
    return {
      status: "graded",
      label: `${grade}/${maxScore}`,
      title: `Graded: ${grade}/${maxScore} (click to review or regrade)`,
      cellClass: "hw-full",
      btnClass: "hw-sub-graded",
      isGraded: true,
      isSubmitted: true,
    };
  }

  if (isSubmitted && submission) {
    return {
      status: "submitted",
      label: "Review",
      title: "Submitted · Awaiting review (click to grade)",
      cellClass: "hw-part",
      btnClass: "hw-sub-submitted",
      isGraded: false,
      isSubmitted: true,
    };
  }

  return {
    status: overdue ? "none-late" : "none",
    label: "·",
    title: `${overdue ? "Overdue · " : ""}Not submitted yet`,
    cellClass: overdue ? "hw-none-late" : "hw-none",
    btnClass: `hw-sub-none ${overdue ? "hw-none-late" : ""}`,
    isGraded: false,
    isSubmitted: false,
  };
}

export function getGradeEndpoint(
  classSlug: string,
  lessonSlug: string,
  submissionId: string,
): string {
  return `/api/classes/${classSlug}/lessons/${lessonSlug}/submissions/${submissionId}/grade`;
}

export function getDownloadEndpoint(
  classSlug: string,
  lessonSlug: string,
  submissionId: string,
): string {
  return `/api/classes/${classSlug}/lessons/${lessonSlug}/submissions/${submissionId}/download`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  try {
    const date = typeof d === "string" ? new Date(d) : d;
    if (Number.isNaN(date.getTime())) return String(d);
    return (
      date.toLocaleString("en-US", {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }) + " UTC"
    );
  } catch {
    return String(d);
  }
}

/** Canonical prefix for student submissions. Scoped by class, lesson, user, and assignment. */
export function submissionPrefix(
  classSlug: string,
  lessonSlug: string,
  userId: string,
  assignmentId: string,
): string {
  return `classes/${classSlug}/${lessonSlug}/submissions/${userId}/${assignmentId}/`;
}

/** Sanitize an uploaded file name, stripping path elements and ensuring .ipynb extension. Client-safe. */
export function sanitizeFileName(fileName: string, fallback?: string): string {
  const trimmed = (fileName || "").trim();
  const rawBase = (trimmed || fallback || "submission.ipynb").replace(/^.*[\\/]/, "");
  let cleaned = rawBase.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!cleaned.endsWith(".ipynb")) {
    cleaned += ".ipynb";
  }
  if (cleaned === ".ipynb") {
    cleaned = "submission.ipynb";
  }
  return cleaned;
}

export type NotebookSubmissionData = {
  id: string;
  userId: string;
  classId: string;
  lessonSlug: string;
  assignmentId: string;
  fileUrl?: string;
  fileName: string;
  fileBytes: number;
  submittedAt: string;
  status: string; // "submitted" | "graded"
  grade: number | null;
  maxGrade: number | null;
  feedback: string | null;
  gradedBy: string | null;
  gradedAt: string | null;
};

export type EnrolledAssignment = {
  classSlug: string;
  classTitle: string;
  lessonSlug: string;
  lessonTitle: string;
  assignment: AssignmentRef;
  isHomework: boolean;
  due: string | null;
};

export function extractLessonAssignments(
  lesson: Pick<Lesson, "slug" | "title" | "practice" | "homework">,
  cls: Pick<ClassMeta, "slug" | "title">,
): EnrolledAssignment[] {
  const list: EnrolledAssignment[] = [];
  const seenIds = new Set<string>();

  if (lesson.homework?.items) {
    for (const item of lesson.homework.items) {
      if (isAssignment(item)) {
        list.push({
          classSlug: cls.slug,
          classTitle: cls.title,
          lessonSlug: lesson.slug,
          lessonTitle: lesson.title,
          assignment: item,
          isHomework: true,
          due: lesson.homework.due ?? null,
        });
        seenIds.add(item.id);
      }
    }
  }

  if (lesson.practice) {
    for (const item of lesson.practice) {
      if (isAssignment(item) && !seenIds.has(item.id)) {
        list.push({
          classSlug: cls.slug,
          classTitle: cls.title,
          lessonSlug: lesson.slug,
          lessonTitle: lesson.title,
          assignment: item,
          isHomework: false,
          due: null,
        });
        seenIds.add(item.id);
      }
    }
  }

  return list;
}
