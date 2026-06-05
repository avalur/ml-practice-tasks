import Link from "next/link";

export default function HomePage() {
  return (
    <section>
      <h1>Practice ML by hand</h1>
      <p>
        LeetCode-style machine-learning exercises. You write the code yourself —
        no ready-made helpers — and the tests run <strong>entirely in your
        browser</strong>. Nothing to install.
      </p>
      <p>
        <Link href="/problems">Browse problems →</Link>
      </p>
    </section>
  );
}
