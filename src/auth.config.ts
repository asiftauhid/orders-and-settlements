import type { NextAuthConfig } from "next-auth";

const PROTECTED_PAGE_PREFIXES = ["/dashboard", "/orders"];
const PROTECTED_API_PREFIX = "/api/orders";

/**
 * Split from `auth.ts` so `proxy.ts` doesn't need to pull in Mongoose/bcrypt
 * just to check whether a request has a valid session cookie — it only
 * needs these callbacks, not the Credentials provider itself (providers
 * are only exercised during the actual sign-in POST request).
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  // Trust the host header — needed when deployed behind Vercel's proxy.
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      const isProtectedApiRoute = pathname.startsWith(PROTECTED_API_PREFIX);
      const isProtectedPage = PROTECTED_PAGE_PREFIXES.some((prefix) =>
        pathname.startsWith(prefix),
      );

      if (isProtectedApiRoute && !isLoggedIn) {
        // Returning `false` triggers Auth.js's default redirect-to-signIn
        // behavior, which is wrong for an API — return a JSON 401 instead.
        return Response.json(
          { error: { message: "Authentication required" } },
          { status: 401 },
        );
      }

      if (isProtectedPage) {
        return isLoggedIn; // `false` redirects the browser to `pages.signIn`
      }

      return true; // everything else (login/signup pages, public assets) is open
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      return session;
    },
  },
};
