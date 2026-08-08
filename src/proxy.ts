import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same behavior, new name).
// We build a second, lightweight NextAuth instance here from `authConfig`
// only — no Credentials provider, no Mongoose/bcrypt — since checking an
// existing session's JWT doesn't need the provider, only the callbacks.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/dashboard/:path*", "/orders/:path*", "/api/orders/:path*"],
};
