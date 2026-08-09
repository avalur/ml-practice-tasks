import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getClasses, myClassSlugs } from "@/lib/classes";
import { JoinClassForm } from "@/components/JoinClassForm";

export const metadata: Metadata = {
  title: "Classes — ML Practice",
  description: "Taught courses: lecture slides, in-class practice and homework.",
};

export default async function ClassesPage() {
  const session = await auth();
  const [all, mine] = await Promise.all([getClasses(), myClassSlugs()]);
  const member = new Set(mine.member);
  const teaching = new Set(mine.teaching);
  const visible = all.filter((c) => member.has(c.slug));

  return (
    <article>
      <h1>Classes</h1>
      <p className="muted">
        Taught courses built on the problems and notebooks from this site — lecture
        slides, in-class practice, and weekly homework. You see a class once you
        join it with the invite code your teacher gives out.
      </p>

      {!session?.user ? (
        <p className="muted" style={{ marginTop: "1.5rem" }}>
          Sign in to join a class and track your homework.
        </p>
      ) : (
        <>
          {visible.length === 0 ? (
            <p className="muted" style={{ marginTop: "1.5rem" }}>
              You are not in any class yet.
            </p>
          ) : (
            <ul className="problem-list" style={{ marginTop: "1.5rem" }}>
              {visible.map((cls) => (
                <li key={cls.slug}>
                  <Link href={`/classes/${cls.slug}`} className="problem-card">
                    <span className="title">{cls.title}</span>
                    <span className="meta">
                      {teaching.has(cls.slug) && <span className="badge hard">teacher</span>}
                      <span className="badge easy">{cls.lessons.length} lessons</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <JoinClassForm />
        </>
      )}
    </article>
  );
}
