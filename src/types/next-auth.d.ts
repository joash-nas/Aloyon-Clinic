// src/types/next-auth.d.ts
import type { DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import type { Role } from "@/lib/roles";
import type { Profile } from "@/types/profile";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      profile?: Profile | null; // profile (includes sex, dob, etc.)
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role;
    email?: string | null;
    name?: string | null;
    image?: string | null;
    profile?: Profile | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: Role;
  }
}
