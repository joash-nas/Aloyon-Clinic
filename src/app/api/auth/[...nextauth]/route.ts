/* eslint-disable @typescript-eslint/no-explicit-any */
/* File: src/app/api/auth/[...nextauth]/route.ts
   Purpose: NextAuth configuration for email/password login with optional 2FA.
*/

import NextAuth, { type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcrypt";
import { z } from "zod";
import { ObjectId } from "mongodb";
import type { Role } from "@/lib/roles";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type UserDoc = {
  _id: ObjectId;
  email: string;
  name?: string | null;
  role?: Role | null;
  passwordHash?: string;
  image?: string | null;
  profile?: {
    fullName?: string | null;
    dob?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  emailVerified?: Date | null;
  twoFactorLastVerifiedAt?: Date | null;
};

const TWOFA_ROLES: Role[] = ["admin", "doctor", "assistant", "sales", "supplier"];
const TWOFA_ROLE_SET = new Set<Role>(TWOFA_ROLES);
const TWOFA_WINDOW_MS = 5 * 60 * 1000;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();
        const password = parsed.data.password;

        const db = await getDb();
        const found = await db.collection<UserDoc>("users").findOne({ email });
        if (!found?.passwordHash) return null;

        const ok = await compare(password, found.passwordHash);
        if (!ok) return null;

        if (!found.emailVerified) return null;

        const role: Role = (found.role ?? "patient") as Role;

        if (TWOFA_ROLE_SET.has(role)) {
          const last = found.twoFactorLastVerifiedAt
            ? new Date(found.twoFactorLastVerifiedAt)
            : null;
          const now = Date.now();
          if (!last || now - last.getTime() > TWOFA_WINDOW_MS) return null;
        }

        return {
          id: found._id.toString(),
          role,
          email: found.email,
          name: found.name ?? null,
          image: found.image ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // First login: store identity into JWT
      if (user) {
        const u = user as {
          id: string;
          role: Role;
          email?: string | null;
          name?: string | null;
          image?: string | null;
        };

        token.sub = u.id; // next-auth uses sub internally
        (token as any).id = u.id;
        (token as any).role = u.role;

        if (u.email !== undefined) token.email = u.email ?? undefined;
        if (u.name !== undefined) token.name = u.name ?? undefined;
        if (u.image !== undefined) token.picture = u.image ?? undefined;

        return token;
      }

      // On every request: ensure user still exists.
      const id = ((token as any)?.id as string | undefined) ?? token.sub;
      if (!id) return token;

      try {
        const db = await getDb();
        const exists = await db.collection<UserDoc>("users").findOne(
          { _id: new ObjectId(id) },
          { projection: { _id: 1 } }
        );

        // If deleted -> return EMPTY TOKEN (NOT null)
        if (!exists) return {} as any;

        return token;
      } catch {
        // safest: treat as logged out if DB error
        return {} as any;
      }
    },

    async session({ session, token }) {
      // token can be null/empty depending on jwt(); handle safely
      const id = ((token as any)?.id as string | undefined) ?? token?.sub;
      const role = (token as any)?.role as Role | undefined;

      // If no identity -> return EMPTY SESSION object so client treats as logged out
      if (!id || !role) return {} as any;

      // attach id/role
      (session.user as any).id = id;
      (session.user as any).role = role;

      // refresh profile/name from DB
      try {
        const db = await getDb();
        const doc = await db.collection<UserDoc>("users").findOne(
          { _id: new ObjectId(id) },
          { projection: { profile: 1, name: 1, role: 1, email: 1, image: 1 } }
        );

        // If deleted between jwt and session (rare) -> also empty session
        if (!doc) return {} as any;

        if (doc.profile) (session.user as any).profile = doc.profile;
        if (doc.name) session.user.name = doc.name;
        if (doc.email) session.user.email = doc.email;
        if (doc.image !== undefined) session.user.image = doc.image ?? null;
        if (doc.role) (session.user as any).role = doc.role as Role;
      } catch {
        // ignore
      }

      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };