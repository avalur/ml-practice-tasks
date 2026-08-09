import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Choose a new password — ML Practice", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <article>
      <h1>Choose a new password</h1>
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
    </article>
  );
}
