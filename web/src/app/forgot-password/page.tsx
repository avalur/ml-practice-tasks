import type { Metadata } from "next";
import { ForgotForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Forgot password — ML Practice", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <article>
      <h1>Forgot your password?</h1>
      <p className="muted">
        We will email you a link to choose a new one. It also works if you have
        only ever signed in with Google or GitHub — that is how you add a password
        to such an account.
      </p>
      <ForgotForm />
    </article>
  );
}
