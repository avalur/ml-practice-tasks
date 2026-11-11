import Link from "next/link";

import { myClassSlugs, visibleClasses } from "@/lib/classes";
import { dueTone, profileUser, studentHomework } from "@/lib/student";
import { JoinClassForm } from "@/components/JoinClassForm";
import { Badge, EmptyState, PageHeader, ProgressBar, Section } from "@/components/ui";
import { DueBadge } from "../DueBadge";

export const metadata = { title: "My classes — ML Practice" };

export default async function MyClassesPage() {
  const user = await profileUser();
  if (!user) return null;

  // visibleClasses(), not getClasses(): a class you were enrolled in and that is
  // back in draft would otherwise sit here as a link to a 404.
  const [{ classes }, mine, visible] = await Promise.all([
    studentHomework(user.id),
    myClassSlugs(),
    visibleClasses(),
  ]);
  const teaching = visible.filter((c) => mine.teaching.includes(c.slug));

  return (
    <>
      <PageHeader
        title="My classes"
        subtitle="The courses you joined with a group code, and how far along your homework is."
      />

      {classes.length === 0 ? (
        <EmptyState title="Not in a group yet">
          Every class under <Link href="/classes">Classes</Link> is open to read; enter your
          teacher&rsquo;s group code below to have your homework counted.
        </EmptyState>
      ) : (
        <div className="class-cards" data-testid="my-classes">
          {classes.map((c) => (
            <Link key={c.slug} href={`/classes/${c.slug}`} className="card class-card">
              <div className="card-head">
                <h2 className="card-title">{c.title}</h2>
                {c.group && <Badge tone="info">{c.group.label}</Badge>}
              </div>
              <ProgressBar
                done={c.hwDone}
                total={c.hwTotal}
                label={`${c.hwDone}/${c.hwTotal} homework tasks`}
              />
              <div className="class-card-foot">
                <span className="muted">{c.lessonCount} lessons</span>
                {c.next && (
                  <span className="class-card-next">
                    Next: {c.next.lessonTitle} <DueBadge entry={c.next} tone={dueTone(c.next)} />
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <Section title="Join a class">
        <JoinClassForm />
      </Section>

      {teaching.length > 0 && (
        <Section title="Classes you teach" action={<Link href="/teach">Teaching dashboard</Link>}>
          <ul className="rows card">
            {teaching.map((c) => (
              <li key={c.slug}>
                <Link className="row-title row-main" href={`/classes/${c.slug}`}>
                  {c.title}
                </Link>
                <Badge tone="info">teacher</Badge>
                {c.draft && <Badge tone="warning">draft</Badge>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
