import Link from "next/link";
import type { Metadata } from "next";
import { myClassSlugs, visibleClasses } from "@/lib/classes";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Classes — ML Practice",
  description: "Taught courses: lecture slides, in-class practice and homework.",
};

export default async function ClassesPage() {
  // Published classes are public: the slides, the practice and the homework of
  // every course are readable without an account. The invite code lives on the
  // class page and only decides whose homework the teacher tracks. A draft class
  // is in this list for its own teachers only.
  const [all, mine] = await Promise.all([visibleClasses(), myClassSlugs()]);
  const member = new Set(mine.member);
  const teaching = new Set(mine.teaching);

  return (
    <article>
      <PageHeader
        title="Classes"
        subtitle="Taught courses built on the problems and notebooks from this site — lecture slides, in-class practice, and weekly homework. Open to everyone; students of a running course join their group with the code their teacher hands out."
      />

      {all.length === 0 ? (
        <EmptyState title="No classes yet" />
      ) : (
        <ul className="problem-list">
          {all.map((cls) => (
            <li key={cls.slug}>
              <Link href={`/classes/${cls.slug}`} className="problem-card">
                <span className="title">{cls.title}</span>
                <span className="meta">
                  {cls.draft && <Badge tone="warning">draft</Badge>}
                  {teaching.has(cls.slug) && <Badge tone="info">teacher</Badge>}
                  {member.has(cls.slug) && !teaching.has(cls.slug) && (
                    <Badge tone="success">joined</Badge>
                  )}
                  <span>{cls.lessons.length} lessons</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
