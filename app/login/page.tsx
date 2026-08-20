"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AuthLayout from "@/components/AuthLayout";
import Button from "@/components/Buttons";
import MessageBox from "@/components/MessageBox";
import { FormInput } from "@/components/FormInput";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("registered") === "true") {
      setIsError(false);

      if (params.get("activation") === "true") {
        setMessage(
          "Account created successfully. Please check your email to activate your account before logging in.",
        );
      } else {
        setMessage("Account created successfully. You can now log in.");
      }
    }

    if (params.get("reset") === "true") {
      setIsError(false);
      setMessage("Password reset successfully. You can now log in.");
    }
  }, []);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMessage("");
    setIsError(false);
    setLoading(true);

    const formattedEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: formattedEmail,
      password,
    });

    if (error) {
      setIsError(true);
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setIsError(true);
      setMessage("Login failed. Please try again.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", data.user.id)
      .single();

    if (profileError) {
      setIsError(true);
      setMessage(profileError.message);
      setLoading(false);
      return;
    }

    if (profile?.is_admin) {
      window.location.href = "/admin";
    } else {
      window.location.href = "/dashboard";
    }
  }

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Log in to manage your Browns Boarding account."
    >
      {/* Message */}
      {message && (
        <MessageBox type={isError ? "error" : "info"}>{message}</MessageBox>
      )}

      <form onSubmit={handleLogin} className="space-y-4 max-w-md mx-auto">
        <FormInput
          id="email"
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <FormInput
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <p className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-[#8B6A4E] hover:text-[#5C4033]"
          >
            Forgotten your password?
          </Link>
        </p>

        <div className="flex justify-center">
          <Button
            variant="dark"
            type="submit"
            className="mx-auto min-w-28"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Log In"}
          </Button>
        </div>
      </form>

      <div className="mt-5 text-center space-y-2">
        <p className="text-sm text-[#8B6A4E]">Don't have an account? </p>
        <Button variant="light" href="/signup" className="mx-auto w-fit">
          Create One
        </Button>
      </div>
    </AuthLayout>
  );
}
