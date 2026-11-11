import Link from "next/link";

import { profileUser } from "@/lib/student";
import { ProfileNav } from "./ProfileNav";

/* The student cabinet: a sidebar and one page per section. Each page checks the
 * user again — a layout and its page render in parallel, so a layout that
 * swaps its children for a sign-in prompt does not stop the page's own reads. */
export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const user = await profileUser();
  if (!user) {
    return (
      <section className="status-page">
        <h1>Your dashboard</h1>
        <p className="muted">
          Sign in to keep your solved problems, your streak, your homework and your
          teacher&rsquo;s feedback in one place.
        </p>
        <p className="status-actions">
          <Link className="btn primary" href="/signin?next=/profile">
            Sign in
          </Link>
          <Link className="btn" href="/register">
            Create an account
          </Link>
        </p>
      </section>
    );
  }

  return (
    <div className="profile-layout">
      <ProfileNav name={user.name} email={user.email} image={user.image} />
      <div className="profile-main">{children}</div>
    </div>
  );
}
