"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AuthLayout from "@/components/AuthLayout";
import Button from "@/components/Buttons";
import MessageBox from "@/components/MessageBox";
import { FormInput } from "@/components/FormInput";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    setMessage("");
    setErrorMessage("");

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Your password has been reset successfully.");

    setTimeout(() => {
      router.push("/login?passwordReset=true");
    }, 1500);
  };

  return (
    <AuthLayout title="Reset Password" subtitle="Enter your new password below">
      {message && <MessageBox type="success">{message}</MessageBox>}

      {errorMessage && <MessageBox type="error">{errorMessage}</MessageBox>}

      <form
        onSubmit={handleResetPassword}
        className="space-y-4 max-w-md mx-auto"
      >
        <FormInput
          id="password"
          label="New Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <FormInput
          id="confirmPassword"
          label="Confirm New Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        <div className="flex justify-center">
          <Button type="submit" disabled={loading}>
            {loading ? "Resetting Password..." : "Reset Password"}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
