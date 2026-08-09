import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import {
  contentHref,
  findLesson,
  flatten,
  getAccess,
  getClassMeta,
  isGroup,
  solvedKeys,
  type ContentRef,
  type GroupRef,
  type Item,
} from "@/lib/classes";
import { PresentButton } from "@/components/PresentButton";

type Params = { slug: string; lesson: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug, lesson } = await params;
  const cls = await getClassMeta(slug);
  const l = cls && findLesson(cls, lesson);
  return { title: l ? `${l.title} — ML Practice` : "Lesson" };
}

// `content`, not `ref`: React reserves a prop called `ref`, and a server
// component that takes one fails to serialise at render time.
function RefRow({
  content,
  done,
}: {
  content: ContentRef;
  done: (r: ContentRef) => boolean;
}) {
  return (
    <Link href={contentHref(content)} className="problem-card">
      <span className="title">
        {done(content) ? "✓ " : ""}
        {content.id}
      </span>
      <span className="meta">
        <span className="badge medium">{content.type}</span>
      </span>
    </Link>
  );
}

/* A whole topic assigned at once stays one row until you open it: a 26-task
   homework should read as "4/26 done", not as a wall of links. */
function GroupCard({ group, done }: { group: GroupRef; done: (r: ContentRef) => boolean }) {
  const n = group.items.filter(done).length;
  const total = group.items.length;
  const complete = n === total;
  // Always folded: the whole point of assigning a topic is that its tasks stay
  // one line until the student asks for them.
  return (
    <details className="ref-group">
      <summary>
        <span className="title">
          {complete ? "✓ " : ""}
          {group.title}
        </span>
        <span className="meta">
          <span className={`badge ${complete ? "easy" : "medium"}`}>
            {n}/{total} done
          </span>
          <code className="topic-tag">{group.pattern}</code>
        </span>
      </summary>
      <ul className="problem-list">
        {group.items.map((content) => (
          <li key={`${content.type}:${content.id}`}>
            <RefRow content={content} done={done} />
          </li>
        ))}
      </ul>
    </details>
  );
}

function RefList({ items, done }: { items: Item[]; done: (r: ContentRef) => boolean }) {
  return (
    <ul className="problem-list">
      {items.map((item) =>
        isGroup(item) ? (
          <li key={`group:${item.pattern}`}>
            <GroupCard group={item} done={done} />
          </li>
        ) : (
          <li key={`${item.type}:${item.id}`}>
            <RefRow content={item} done={done} />
          </li>
        ),
      )}
    </ul>
  );
}

export default async function LessonPage({ params }: { params: Promise<Params> }) {
  const { slug, lesson: lessonSlug } = await params;
  const cls = await getClassMeta(slug);
  const lesson = cls && findLesson(cls, lessonSlug);
  if (!cls || !lesson) notFound();

  const access = await getAccess(slug);
  if (!access.classRow) notFound();
  if (!access.isMember) {
    return (
      <article>
        <h1>{lesson.title}</h1>
        <p className="muted">
          You are not in this class. Ask your teacher for the invite code, then
          enter it on the <Link href="/classes">Classes</Link> page.
        </p>
      </article>
    );
  }

  const refs = flatten([...lesson.practice, ...(lesson.homework?.items ?? [])]);
  const [solved, delivered] = await Promise.all([
    access.userId ? solvedKeys([access.userId], refs) : Promise.resolve(new Set<string>()),
    prisma.lessonSession.findFirst({
      where: { classId: access.classRow.id, lessonSlug, endedAt: { not: null } },
      orderBy: { endedAt: "desc" },
      select: { pdfBytes: true, endedAt: true },
    }),
  ]);

  const done = (r: ContentRef) =>
    !!access.userId && solved.has(`${access.userId}|${r.type}:${r.id}`);
  const hwRefs = flatten(lesson.homework?.items ?? []);
  const slidesUrl = `/classes/${slug}/${lessonSlug}/present.html`;
  const due = lesson.homework ? new Date(lesson.homework.due) : null;

  return (
    <article>
      <p className="muted class-breadcrumb">
        <Link href="/classes">Classes</Link> ›{" "}
        <Link href={`/classes/${slug}`}>{cls.title}</Link>
      </p>
      <h1>{lesson.title}</h1>
      {lesson.date && <p className="muted">{lesson.date}</p>}

      <div className="class-lesson-actions">
        <a className="bt-clear-btn" href={slidesUrl} target="_blank" rel="noopener">
          Open slides
        </a>
        {access.isTeacher && <PresentButton classSlug={slug} lessonSlug={lessonSlug} />}
      </div>

      {/* The lecture PDF is downloaded to the teacher's machine by "Finish
          lesson" and shared with the class directly, so the site only reports
          whether the lesson has been delivered. */}
      <p className="muted">
        {delivered?.endedAt
          ? `Delivered ${delivered.endedAt.toLocaleDateString()}` +
            (delivered.pdfBytes
              ? ` — notes exported (${Math.round(delivered.pdfBytes / 104857.6) / 10} MB) and shared by the teacher.`
              : ".")
          : access.isTeacher
            ? "Not delivered yet. “Finish lesson” in present mode saves a PDF of every slide with your notes to your downloads."
            : "Lecture notes are shared by the teacher after the lesson."}
      </p>

      {lesson.practice.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2>In-class practice</h2>
          <RefList items={lesson.practice} done={done} />
        </section>
      )}

      {lesson.homework && lesson.homework.items.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2>Homework</h2>
          <p className="muted">
            Due {due && !Number.isNaN(due.getTime()) ? due.toLocaleString() : lesson.homework.due}
            {" · "}
            {hwRefs.filter(done).length}/{hwRefs.length} done
          </p>
          <RefList items={lesson.homework.items} done={done} />
        </section>
      )}
    </article>
  );
}
