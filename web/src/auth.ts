import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

// Auth.js v5. Providers read credentials from the AUTH_<PROVIDER>_ID/SECRET env
// vars by convention. JWT sessions (no database yet) — Phase 2 adds a Prisma
// adapter + database sessions for persistent progress.
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub, Google],
  session: { strategy: "jwt" },
  // Required for self-hosted / `next start` (Vercel sets this automatically).
  trustHost: true,
});
