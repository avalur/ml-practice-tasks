"use client";

import { useMemo, useState } from "react";
import { AttendanceToggle } from "@/components/AttendanceToggle";
import {
  SubmissionReviewModal,
  type SubmissionModalData,
} from "@/components/SubmissionReviewModal";
import {
  computeAssignmentCellState,
  isAssignment,
  isGroup,
  isLink,
  type AssignmentRef,
  type Item,
  type TrackableRef,
  type TrackedItem,
} from "@/lib/classes-shared";

export type HomeworkStudent = {
  id: string;
  name: string | null;
  email: string | null;
  group?: {
    code: string;
    label: string;
  } | null;
};

export type LessonHomeworkTableProps = {
  classSlug: string;
  lessonSlug: string;
  roster: HomeworkStudent[];
  items: (TrackedItem | Item)[];
  initialSubmissions: SubmissionModalData[];
  solvedKeys: string[];
  classId: string;
  due: string | null;
  attendedUserIds: string[];
  teacherEmail?: string | null;
};

function cellClass(done: number, total: number, overdue: boolean): string {
  if (total === 0) return "hw-na";
  if (done === total) return "hw-full";
  if (done > 0) return "hw-part";
  return overdue ? "hw-none-late" : "hw-none";
}

export function LessonHomeworkTable({
  classSlug,
  lessonSlug,
  roster,
  items,
  initialSubmissions,
  solvedKeys,
  due,
  attendedUserIds,
  teacherEmail,
}: LessonHomeworkTableProps) {
  const solvedSet = useMemo(() => new Set(solvedKeys), [solvedKeys]);
  const attendedSet = useMemo(() => new Set(attendedUserIds), [attendedUserIds]);

  const [submissionsMap, setSubmissionsMap] = useState<Map<string, SubmissionModalData>>(() => {
    const map = new Map<string, SubmissionModalData>();
    for (const sub of initialSubmissions) {
      map.set(`${sub.userId}|${sub.assignmentId}`, sub);
    }
    return map;
  });

  const [activeModal, setActiveModal] = useState<{
    student: HomeworkStudent;
    assignment: AssignmentRef;
    submission: SubmissionModalData | null;
  } | null>(null);

  const overdue = due ? new Date(due).getTime() < Date.now() : false;

  function isDoneRef(userId: string, ref: TrackableRef): boolean {
    if (ref.type === "assignment") {
      return submissionsMap.has(`${userId}|${ref.id}`);
    }
    return solvedSet.has(`${userId}|${ref.type}:${ref.id}`);
  }

  // Update submission state in matrix cell (optimistic or confirmed)
  function handleGradeSaved(updatedSubmission: SubmissionModalData) {
    setSubmissionsMap((prev) => {
      const next = new Map(prev);
      next.set(`${updatedSubmission.userId}|${updatedSubmission.assignmentId}`, updatedSubmission);
      return next;
    });
  }

  // Rollback submission state in matrix cell on failure
  function handleGradeRollback(previousSubmission: SubmissionModalData) {
    setSubmissionsMap((prev) => {
      const next = new Map(prev);
      next.set(`${previousSubmission.userId}|${previousSubmission.assignmentId}`, previousSubmission);
      return next;
    });
  }

  return (
    <>
      <div className="hw-scroll">
        <table className="hw-table">
          <thead>
            <tr>
              <th className="hw-name">Student</th>
              <th className="hw-group">Group</th>
              <th className="hw-att" title="Attendance on this lecture">
                Attendance
              </th>
              {items.map((item) => {
                if (isGroup(item)) {
                  return (
                    <th
                      key={`group:${item.pattern}`}
                      title={`${item.pattern} — ${item.items.length} tasks`}
                    >
                      {item.title}
                    </th>
                  );
                }
                if (isLink(item)) {
                  return (
                    <th key={`link:${item.href}`} title={item.title}>
                      {item.title}
                    </th>
                  );
                }
                if (isAssignment(item)) {
                  const maxPts = item.maxScore ?? 100;
                  return (
                    <th
                      key={`assignment:${item.id}`}
                      title={`${item.title} (Assignment · max ${maxPts} pts)`}
                    >
                      {item.title || item.id}
                    </th>
                  );
                }
                return (
                  <th key={`${item.type}:${item.id}`} title={item.id}>
                    {item.id.split("/")[1] ?? item.id}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {roster.map((m) => (
              <tr key={m.id}>
                <td className="hw-name">{m.name || m.email}</td>
                <td className="hw-group" title={m.group?.code}>
                  {m.group?.label}
                </td>
                <td className="hw-att-cell">
                  <AttendanceToggle
                    classSlug={classSlug}
                    lessonSlug={lessonSlug}
                    userId={m.id}
                    initialAttended={attendedSet.has(m.id)}
                    studentName={m.name || m.email || undefined}
                  />
                </td>
                {items.map((item) => {
                  if (isLink(item)) {
                    return (
                      <td key={`link:${item.href}`} className="hw-na" title="External link">
                        —
                      </td>
                    );
                  }

                  if (isAssignment(item)) {
                    const sub = submissionsMap.get(`${m.id}|${item.id}`) ?? null;
                    const cellState = computeAssignmentCellState({
                      assignment: item,
                      submission: sub,
                      overdue,
                    });

                    return (
                      <td
                        key={`assignment:${item.id}`}
                        className={`hw-sub-cell ${cellState.cellClass}`}
                      >
                        <button
                          type="button"
                          className={`hw-sub-btn ${cellState.btnClass}`}
                          onClick={() =>
                            setActiveModal({
                              student: m,
                              assignment: item,
                              submission: sub,
                            })
                          }
                          title={cellState.title}
                          data-testid={`sub-cell-${m.id}-${item.id}`}
                          aria-label={`${m.name || m.email}: ${item.title} — ${cellState.title}`}
                        >
                          {cellState.label}
                        </button>
                      </td>
                    );
                  }

                  if (isGroup(item)) {
                    const doneCount = item.items.filter((ref) => isDoneRef(m.id, ref)).length;
                    const totalCount = item.items.length;
                    const cClass = cellClass(doneCount, totalCount, overdue);
                    return (
                      <td
                        key={`group:${item.pattern}`}
                        className={cClass}
                        title={`${item.title}: ${doneCount}/${totalCount}`}
                      >
                        {doneCount}/{totalCount}
                      </td>
                    );
                  }

                  const ok = isDoneRef(m.id, item);
                  const cClass = ok ? "hw-full" : overdue ? "hw-none-late" : "hw-none";
                  return (
                    <td
                      key={`${item.type}:${item.id}`}
                      className={cClass}
                      title={`${item.id}: ${ok ? "done" : "not done"}`}
                    >
                      {ok ? "✓" : "·"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SubmissionReviewModal
        isOpen={activeModal !== null}
        onClose={() => setActiveModal(null)}
        submission={activeModal?.submission ?? null}
        student={activeModal?.student ?? null}
        assignment={activeModal?.assignment ?? null}
        classSlug={classSlug}
        lessonSlug={lessonSlug}
        onGradeSaved={handleGradeSaved}
        onGradeRollback={handleGradeRollback}
        teacherEmail={teacherEmail}
      />
    </>
  );
}
