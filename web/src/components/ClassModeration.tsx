import Link from "next/link";

import type { Access } from "@/lib/classes";
import { SuspendToggle } from "./SuspendToggle";

/* What a class page shows about moderation, by who is looking:
 *   - teachers and admins of a suspended class: the notice, with the reason;
 *   - admins: their bar with the switch, on every class. */
export function ClassModeration({ slug, access }: { slug: string; access: Access }) {
  return (
    <>
      {access.suspended && (access.isTeacher || access.isAdmin) && (
        <p className="class-suspended-note" data-testid="suspended-note">
          <span className="badge hard">suspended</span> The site admins have taken this class
          down: it answers 404 to students and its group codes enroll nobody, whatever the
          Publish button says.
          {access.suspended.reason && (
            <>
              {" "}
              Reason: <em>{access.suspended.reason}</em>
            </>
          )}
        </p>
      )}
      {access.isAdmin && (
        <div className="class-teacher-bar class-admin-bar" data-testid="admin-bar">
          <span className="badge medium">admin</span>
          <span className="muted">
            {access.suspended ? "suspended" : access.published ? "published" : "draft"}
          </span>
          <SuspendToggle slug={slug} suspended={!!access.suspended} />
          <Link href="/admin/reports">Reports</Link>
        </div>
      )}
    </>
  );
}
