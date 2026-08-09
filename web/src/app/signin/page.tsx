import { Suspense } from "react";
import type { Metadata } from "next";
import { SignInForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Sign in — ML Practice", robots: { index: false } };

export default function SignInPage() {
  return (
    <article>
      <h1>Sign in</h1>
      <p className="muted">
        Signing in keeps your solved tasks, notebooks and homework in one place.
      </p>
      {/* useSearchParams needs a boundary for the static shell. */}
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </article>
  );
}
