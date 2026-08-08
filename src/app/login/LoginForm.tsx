"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // proxy.ts redirects unauthenticated visitors here with ?callbackUrl=<original-path>
  // set automatically by Auth.js's `authorized` callback — send them back there after login.
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  async function handleLogin(email: string, password: string) {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      return "Invalid email or password";
    }

    router.push(callbackUrl);
    router.refresh();
    return null;
  }

  return (
    <AuthForm
      title="Log in"
      submitLabel="Log in"
      onSubmit={handleLogin}
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-zinc-900 underline dark:text-zinc-50"
          >
            Sign up
          </Link>
        </>
      }
    />
  );
}
