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
  providers: [GitHub, Google],
  session: { strategy: "database" },
  // Required for self-hosted / `next start` (Vercel sets this automatically).
  trustHost: true,
});
