import { Suspense } from "react";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Create an account — ML Practice", robots: { index: false } };

export default function RegisterPage() {
  return (
    <article>
      <h1>Create an account</h1>
      <p className="muted">
        Everything on this site is readable without one. An account is what saves
        your progress — and what lets a teacher see your homework.
      </p>
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
    </article>
  );
}
