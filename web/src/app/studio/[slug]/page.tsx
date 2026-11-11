import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { editableClass } from "@/lib/studio";
import { slideCount } from "@/lib/deck-sanitize";
import { PublishToggle } from "@/components/PublishToggle";
import { CourseDetailsForm, DeleteCourseButton, LessonList } from "@/components/StudioForms";
import { Badge, Notice, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Course — Studio" };

export default async function StudioCoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = await editableClass(slug);
  if (!g.ok) notFound();
  const { cls } = g;

  const lessons = await prisma.studioLesson.findMany({
    where: { classId: cls.id },
    orderBy: { position: "asc" },
    select: { slug: true, title: true, date: true, deck: true },
  });

  return (
    <article className="studio">
      <p className="muted class-breadcrumb">
        <Link href="/teach">Teaching</Link> › <Link href="/studio">Studio</Link> › {cls.title}
      </p>
      <PageHeader
        title={cls.title}
        actions={
          <>
            {cls.suspendedAt ? (
              <Badge tone="danger">suspended</Badge>
            ) : cls.publishedAt ? (
              <Badge tone="success">published</Badge>
            ) : (
              <Badge tone="warning">draft</Badge>
            )}
            <Link className="btn small" href={`/classes/${slug}`}>
              Course page
            </Link>
            <Link className="btn small" href={`/classes/${slug}/homework?tab=groups`}>
              Group codes &amp; homework
            </Link>
            {!cls.suspendedAt && <PublishToggle slug={slug} published={!!cls.publishedAt} />}
          </>
        }
      />
      {cls.suspendedAt && (
        <Notice tone="danger">
          <Badge tone="danger">suspended</Badge> The site admins have taken this course down.
          {cls.suspendedReason && (
            <>
              {" "}
              Reason: <em>{cls.suspendedReason}</em>
            </>
          )}
        </Notice>
      )}
      {!cls.suspendedAt && (
        <Notice tone={cls.publishedAt ? "info" : "warning"}>
          {cls.publishedAt ? (
            <>
              Published and <strong>unlisted</strong>: anyone with the link{" "}
              <code>/classes/{slug}</code> can open it; give your students that link and a
              group code.{cls.featuredAt ? " The site admins have also listed it on /classes." : ""}
            </>
          ) : (
            <>Only you can see this course until you publish it.</>
          )}
        </Notice>
      )}

      <h2>Lessons</h2>
      <LessonList
        slug={slug}
        lessons={lessons.map((l) => ({ slug: l.slug, title: l.title, date: l.date, slides: slideCount(l.deck) }))}
      />

      <h2>Details</h2>
      <CourseDetailsForm slug={slug} title={cls.title} description={cls.description ?? ""} />

      <div className="studio-danger-zone">
        <DeleteCourseButton slug={slug} />
      </div>
    </article>
  );
}
