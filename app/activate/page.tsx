"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";
import Button from "@/components/Buttons"

export default function ActivateAccountPage() {
  const searchParams = useSearchParams();
  const [expiredToken, setExpiredToken] = useState(false);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    activateAccount();
  }, []);

  async function resendActivationEmail() {
  const token = searchParams.get("token");

  const response = await fetch(
    "/api/resend-activation-email-from-token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    setMessage(
      result.error || "Unable to resend activation email."
    );
    return;
  }

  setMessage(
    "A new activation email has been sent. Please check your inbox."
  );

  setExpiredToken(false);
}

  async function activateAccount() {
    const token = searchParams.get("token");

    if (!token) {
      setMessage("Activation token is missing.");
      setSuccess(false);
      setLoading(false);
      return;
    }

    const response = await fetch("/api/activate-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
      }),
    });

    const result = await response.json();

    setLoading(false);

if (!response.ok) {
  if (
    result.error?.toLowerCase().includes("expired")
  ) {
    setExpiredToken(true);
  }

  setMessage(result.error || "Unable to activate account.");
  setSuccess(false);
  return;
}

    setMessage(result.message || "Account activated successfully.");
    setSuccess(true);
  }

  return (
    <AuthLayout
        title="Account Activation"
        maxWidth="max-w-md"
    >
    {loading ? (
        <p className="text-sm md:text-base text-center text-[#8B6A4E] mb-4">
            Activating your account...
        </p>
        ) : (
        <>
            <div
            className={`p-3 md:p-4 rounded-lg mb-4 border ${
                success
                ? "bg-green-50 border-green-300"
                : "bg-red-50 border-red-300"
            }`}
            >
            <p
                className={`font-medium ${
                success ? "text-green-800" : "text-red-800"
                }`}
            >
                {message}
            </p>
            </div>

            {expiredToken && (
            <div className="flex justify-center mb-3">
              <Button
                  type="button"
                  variant ="light"
                  onClick={resendActivationEmail}
              >
                  Resend Activation Email
              </Button>
            </div>
            )}

            {success ? (
            
            <div className="flex justify-center">
              <Button variant="light" href="/login">Go to Login</Button>
            </div>
            ) : (
            <div className="flex justify-center">
              <Button variant="light" href="/">Back to Home</Button>
            </div>
            )}
        </>
        )}
    </AuthLayout>
  );
}