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

/* What a student may hand in for an assignment, by extension — class.json's
 * `accept`, a closed list validated by export_decks.py. No `accept` means a
 * notebook, which is every assignment written before the field existed.
 * The server half (content types for the upload token) is in submissions.ts. */
export type SubmissionFormat = "ipynb" | "pdf";

export const SUBMISSION_FORMATS: Record<
  SubmissionFormat,
  { ext: string; label: string; noun: string; accept: string; icon: string }
> = {
  ipynb: {
    ext: ".ipynb",
    label: "Jupyter Notebook (.ipynb)",
    noun: "Notebook",
    accept: ".ipynb,application/x-ipynb+json",
    icon: "📓",
  },
  pdf: { ext: ".pdf", label: "PDF (.pdf)", noun: "PDF", accept: ".pdf,application/pdf", icon: "📄" },
};

const DEFAULT_FORMATS: SubmissionFormat[] = ["ipynb"];

/** The formats an assignment takes; anything unknown is dropped, nothing left means a notebook. */
export function acceptedFormats(assignment?: { accept?: readonly string[] } | null): SubmissionFormat[] {
  const list = (assignment?.accept ?? []).filter(
    (f): f is SubmissionFormat => Object.hasOwn(SUBMISSION_FORMATS, f),
  );
  return list.length ? list : DEFAULT_FORMATS;
}

/** True for the notebook-only assignments, whose wording predates other formats. */
export function isNotebookOnly(formats: readonly SubmissionFormat[]): boolean {
  return formats.length === 1 && formats[0] === "ipynb";
}

/** ".ipynb" or ".ipynb, .pdf" — for buttons and hints. */
export function formatExts(formats: readonly SubmissionFormat[]): string {
  return formats.map((f) => SUBMISSION_FORMATS[f].ext).join(", ");
}

/** The format of a stored file, by extension; a stored file is always one of them. */
export function fileFormat(fileName: string): SubmissionFormat {
  const lower = (fileName || "").toLowerCase();
  for (const f of Object.keys(SUBMISSION_FORMATS) as SubmissionFormat[]) {
    if (lower.endsWith(SUBMISSION_FORMATS[f].ext)) return f;
  }
  return "ipynb";
}

/** Pure validation for an uploaded submission file. Client- and server-safe. */
export function validateNotebookFile(
  fileName: string,
  fileBytes: number,
  maxBytes: number = MAX_SUBMISSION_BYTES,
  formats: readonly SubmissionFormat[] = DEFAULT_FORMATS,
): { valid: boolean; error?: string } {
  const lower = (fileName || "").toLowerCase();
  if (!fileName || !formats.some((f) => lower.endsWith(SUBMISSION_FORMATS[f].ext))) {
    const labels = formats.map((f) => SUBMISSION_FORMATS[f].label).join(" or ");
    return { valid: false, error: `Only ${labels} files are accepted.` };
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
  /** What may be handed in; absent means `["ipynb"]` (see `acceptedFormats`). */
  accept?: SubmissionFormat[];
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

export type Milestone = {
  date: string;
  title: string;
  kind: "deadline" | "event";
  tentative?: boolean;
};

export type DebateTeamSpec = {
  id: string;
  name: string;
  members?: string[];
};

export type DebateSpec = {
  id: string;
  title: string;
  motion?: string;
  teams: DebateTeamSpec[];
};

export type Lesson = {
  slug: string;
  title: string;
  date: string | null;
  deck: string | null;
  practice: Item[];
  homework: Homework | null;
  milestones?: Milestone[];
  debates?: DebateSpec[];
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

export function formatMilestoneDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

/** The submitted notebook rendered as a page — opened in a new tab to skim it. */
export function getViewEndpoint(
  classSlug: string,
  lessonSlug: string,
  submissionId: string,
): string {
  return `/api/classes/${classSlug}/lessons/${lessonSlug}/submissions/${submissionId}/view`;
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

/** A due date as a timestamp. class.json writes "2026-11-16T23:59"; a bare
 * "2026-11-16" means the end of that day, not its first minute. */
export function dueMs(due: string | null | undefined): number | null {
  if (!due) return null;
  const t = new Date(/^\d{4}-\d{2}-\d{2}$/.test(due) ? `${due}T23:59:59Z` : due).getTime();
  return Number.isNaN(t) ? null : t;
}

export function isOverdue(due: number | null, now = Date.now()): boolean {
  return due !== null && due < now;
}

/** A calendar day, "3 Nov" (or "3 Nov 2026" with `year`). Always UTC with an
 * explicit locale: these render on the server and in the browser, and a
 * locale- or zone-dependent string is a hydration mismatch and a date that
 * moves by one depending on who looks. */
export function formatDay(
  d: string | Date | null | undefined,
  opts: { year?: boolean } = {},
): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00Z` : d) : d;
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    ...(opts.year ? { year: "numeric" } : {}),
  });
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

/** Sanitize an uploaded file name: strip path elements and end it in one of the
 * accepted extensions (lower-cased, so the server's path check agrees), adding
 * the first one when it has none. Client-safe; mirrored in submissions.ts. */
export function sanitizeFileName(
  fileName: string,
  fallback?: string,
  formats: readonly SubmissionFormat[] = DEFAULT_FORMATS,
): string {
  const exts = formats.map((f) => SUBMISSION_FORMATS[f].ext);
  const trimmed = (fileName || "").trim();
  const rawBase = (trimmed || fallback || `submission${exts[0]}`).replace(/^.*[\\/]/, "");
  let cleaned = rawBase.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ext = exts.find((e) => cleaned.toLowerCase().endsWith(e)) ?? exts[0];
  cleaned = cleaned.toLowerCase().endsWith(ext) ? cleaned.slice(0, -ext.length) + ext : cleaned + ext;
  if (cleaned === ext) {
    cleaned = `submission${ext}`;
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

// --- Debate polls (client-safe types & pure helpers) ------------------------

export type DebateVoterDTO = {
  userId: string;
  name: string;
  email: string | null;
  teamId: string;
  votedAt: string;
};

export type DebateTeamResultDTO = {
  id: string;
  name: string;
  members: string[];
  votes: number;
  percent: number;
};

export type DebatePollDTO = {
  id: string;
  title: string;
  motion: string | null;
  isOpen: boolean;
  openedAt: string | null;
  closedAt: string | null;
  totalVotes: number;
  teams: DebateTeamResultDTO[];
  myVote: string | null;
  /** Present only for teachers of the class; omitted for everyone else. */
  voters?: DebateVoterDTO[];
};

export type LessonDebatesDTO = {
  now: string;
  polls: DebatePollDTO[];
  unavailable?: boolean;
};

export type DebatePollStatus = "pending" | "open" | "closed";

export function debatePollStatus(
  poll: Pick<DebatePollDTO, "isOpen" | "openedAt" | "closedAt" | "totalVotes">,
): DebatePollStatus {
  if (poll.isOpen) return "open";
  if (poll.openedAt || poll.closedAt || poll.totalVotes > 0) return "closed";
  return "pending";
}

export function teamVotePercent(votes: number, totalVotes: number): number {
  if (totalVotes <= 0 || votes <= 0) return 0;
  return Math.round((votes / totalVotes) * 100);
}

/** Team ids tied for the highest vote count, or empty when nobody has voted. */
export function winningTeamIds(teams: readonly Pick<DebateTeamResultDTO, "id" | "votes">[]): string[] {
  const top = teams.reduce((max, t) => (t.votes > max ? t.votes : max), 0);
  if (top <= 0) return [];
  return teams.filter((t) => t.votes === top).map((t) => t.id);
}
