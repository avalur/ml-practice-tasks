import Link from "next/link";
import type { Metadata } from "next";
import { getClasses, myClassSlugs } from "@/lib/classes";

export const metadata: Metadata = {
  title: "Classes — ML Practice",
  description: "Taught courses: lecture slides, in-class practice and homework.",
};

export default async function ClassesPage() {
  // Classes are public: the slides, the practice and the homework of every course
  // are readable without an account. The invite code lives on the class page and
  // only decides whose homework the teacher tracks.
  const [all, mine] = await Promise.all([getClasses(), myClassSlugs()]);
  const member = new Set(mine.member);
  const teaching = new Set(mine.teaching);

  return (
    <article>
      <h1>Classes</h1>
      <p className="muted">
        Taught courses built on the problems and notebooks from this site — lecture
        slides, in-class practice, and weekly homework. Open to everyone; students
        of a running course join their group with the code their teacher hands out.
      </p>

      {all.length === 0 ? (
        <p className="muted" style={{ marginTop: "1.5rem" }}>
          No classes yet.
        </p>
      ) : (
        <ul className="problem-list" style={{ marginTop: "1.5rem" }}>
          {all.map((cls) => (
            <li key={cls.slug}>
              <Link href={`/classes/${cls.slug}`} className="problem-card">
                <span className="title">{cls.title}</span>
                <span className="meta">
                  {teaching.has(cls.slug) && <span className="badge hard">teacher</span>}
                  {member.has(cls.slug) && !teaching.has(cls.slug) && (
                    <span className="badge easy">joined</span>
                  )}
                  <span className="badge medium">{cls.lessons.length} lessons</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
