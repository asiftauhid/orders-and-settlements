"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  const router = useRouter();

  async function handleSignup(email: string, password: string) {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return data?.error?.message ?? "Something went wrong. Please try again.";
    }

    // Signup succeeded — log the user in immediately instead of making
    // them re-enter their credentials on a separate login screen.
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      return "Account created, but automatic login failed. Please log in.";
    }

    router.push("/dashboard");
    router.refresh();
    return null;
  }

  return (
    <AuthForm
      title="Create an account"
      submitLabel="Sign up"
      onSubmit={handleSignup}
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-zinc-900 underline dark:text-zinc-50"
          >
            Log in
          </Link>
        </>
      }
    />
  );
}
