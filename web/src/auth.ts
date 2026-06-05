import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

// Auth.js v5. Providers read credentials from the AUTH_<PROVIDER>_ID/SECRET env
// vars by convention. Prisma adapter + database sessions persist users and
// power per-user progress (requires DATABASE_URL).
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    // Link accounts that share a verified email across providers (GitHub +
    // Google both verify emails) so one email = one account.
    GitHub({ allowDangerousEmailAccountLinking: true }),
    Google({ allowDangerousEmailAccountLinking: true }),
  ],
  session: { strategy: "database" },
  // Required for self-hosted / `next start` (Vercel sets this automatically).
  trustHost: true,
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});
