import Link from "next/link";

import type { Access } from "@/lib/classes";
import { SuspendToggle } from "./SuspendToggle";
import { AdminAction } from "./AdminAction";
import { Badge, Notice } from "./ui";

/* What a class page shows about moderation, by who is looking:
 *   - teachers and admins of a suspended class: the notice, with the reason;
 *   - admins: their bar with the switch, on every class. */
export function ClassModeration({ slug, access }: { slug: string; access: Access }) {
  return (
    <>
      {access.suspended && (access.isTeacher || access.isAdmin) && (
        <Notice tone="danger" testId="suspended-note">
          <Badge tone="danger">suspended</Badge> The site admins have taken this class
          down: it answers 404 to students and its group codes enroll nobody, whatever the
          Publish button says.
          {access.suspended.reason && (
            <>
              {" "}
              Reason: <em>{access.suspended.reason}</em>
            </>
          )}
        </Notice>
      )}
      {access.isAdmin && (
        <div className="class-teacher-bar class-admin-bar" data-testid="admin-bar">
          <Badge tone="info">admin</Badge>
          <span className="muted">
            {access.suspended ? "suspended" : access.published ? "published" : "draft"}
          </span>
          <SuspendToggle slug={slug} suspended={!!access.suspended} />
          {/* Studio courses are unlisted until an admin lists them. */}
          {access.studio && (
            <AdminAction
              url={`/api/admin/classes/${slug}/feature`}
              body={{ featured: !access.featured }}
              label={access.featured ? "Unlist from /classes" : "List on /classes"}
              testId="feature-toggle"
            />
          )}
          <Link href="/admin/reports">Reports</Link>
        </div>
      )}
    </>
  );
}
