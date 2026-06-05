import type { DefaultSession } from "next-auth";

// Expose the DB user id on the session (set in the auth `session` callback).
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}
