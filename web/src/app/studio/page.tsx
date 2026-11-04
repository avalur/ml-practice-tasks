import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { teacherState } from "@/lib/teachers";
import { STUDIO_LIMITS } from "@/lib/studio";
import { NewCourseForm } from "@/components/StudioForms";

export const metadata: Metadata = { title: "Studio — ML Practice" };

/* The teacher's home: their courses, and a form for the next one. Anyone
 * without the live role is sent to /teach, which explains what to do. */
export default async function StudioPage() {
  if ((await teacherState()).kind !== "active") redirect("/teach");
  const session = await auth();
  const userId = session!.user!.id!;
  const email = session!.user!.email!.toLowerCase();

  const courses = await prisma.class.findMany({
    where: { source: "studio", OR: [{ ownerId: userId }, { teacherEmails: { has: email } }] },
    orderBy: { createdAt: "desc" },
    select: {
      slug: true,
      title: true,
      publishedAt: true,
      suspendedAt: true,
      featuredAt: true,
      _count: { select: { studioLessons: true, enrollments: true } },
    },
  });

  return (
    <article className="studio">
      <nav className="admin-nav">
        <span className="badge easy">studio</span>
        <Link href="/studio">Courses</Link>
        <Link href="/studio/proposals">Task proposals</Link>
        <Link href="/studio/settings">AI settings</Link>
      </nav>
      <h1>Your courses</h1>
      {courses.length === 0 ? (
        <p className="muted">No courses yet — start one below.</p>
      ) : (
        <ul className="admin-list" data-testid="studio-courses">
          {courses.map((c) => (
            <li key={c.slug} className="admin-card">
              <div className="admin-actions">
                <Link href={`/studio/${c.slug}`}>
                  <strong>{c.title}</strong>
                </Link>
                {c.suspendedAt ? (
                  <span className="badge hard">suspended</span>
                ) : c.publishedAt ? (
                  <span className="badge easy">published</span>
                ) : (
                  <span className="badge medium">draft</span>
                )}
                {c.featuredAt && <span className="badge">listed</span>}
                <span className="muted">
                  {c._count.studioLessons} lessons · {c._count.enrollments} joined
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {courses.length < STUDIO_LIMITS.courses && (
        <>
          <h2>New course</h2>
          <NewCourseForm />
        </>
      )}
    </article>
  );
}
