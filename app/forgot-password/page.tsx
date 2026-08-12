"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import AuthLayout from "@/components/AuthLayout";
import Button from "@/components/Buttons"
import MessageBox from "@/components/MessageBox";
import {FormInput} from "@/components/FormInput";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    setMessage("");
    setErrorMessage("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Password reset email sent. Please check your inbox.");
    setLoading(false);
  };

  return (
    <AuthLayout
        title="Forgot Password"
        subtitle="Enter your email address and we will send you a link to reset your password."
    >
      {message && (
      <MessageBox type="success">
        {message}
      </MessageBox>
      )}

        {message && (
        <MessageBox type="error">
          {message}
        </MessageBox>
        )}
        
        <form onSubmit={handlePasswordReset} className="space-y-4 max-w-md mx-auto">
          <FormInput
            id="email"
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="flex justify-center">

            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? "Sending Reset Email..." : "Send Reset Email"}
            </Button>
          </div>
          </form>
    </AuthLayout>

  );
}