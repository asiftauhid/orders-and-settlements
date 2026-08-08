import type { DefaultSession } from "next-auth";

// Auth.js's default Session/JWT types don't know about our `id` field.
// This augments them so `session.user.id` and `token.id` type-check
// everywhere we read the current user's id.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
  }
}
