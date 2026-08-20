"use client";

import { useEffect, useState, type FormEvent } from "react";

import { supabase } from "@/lib/supabase";

import CustomerPageLayout from "@/components/CustomerPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import MessageBox from "@/components/MessageBox";
import LoadingScreen from "@/components/LoadingScreen";
import { FormInput } from "@/components/FormInput";
import { authenticatedApiRequest } from "@/lib/client/authenticated-api";

type CompleteActivationResponse = {
  success: boolean;
  profileActivated: boolean;
  alreadyActivated: boolean;
  profile?: {
    id: string;
    active: boolean;
    wasActivated: boolean;
    activatedAt?: string | null;
  };
  message?: string;
  error?: string;
};

export default function SetPasswordPage() {
  const [checkingSession, setCheckingSession] = useState(true);

  const [saving, setSaving] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const [sessionAvailable, setSessionAvailable] = useState(false);

  useEffect(() => {
    checkInvitationSession();
  }, []);

  async function checkInvitationSession() {
    setCheckingSession(true);
    setMessage("");
    setIsError(false);

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      setIsError(true);
      setMessage(error.message);
      setCheckingSession(false);
      return;
    }

    if (session) {
      setSessionAvailable(true);
      setCheckingSession(false);
      return;
    }

    /*
     * The invitation tokens may still be processing when the
     * page first loads. Listen briefly for the auth event that
     * establishes the invited customer's session.
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession) {
        setSessionAvailable(true);
        setMessage("");
        setIsError(false);
        setCheckingSession(false);
      }
    });

    window.setTimeout(() => {
      setCheckingSession(false);
    }, 2500);

    return () => {
      subscription.unsubscribe();
    };
  }

  async function handleSetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setMessage("");
    setIsError(false);

    if (password.length < 8) {
      setIsError(true);
      setMessage("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setIsError(true);
      setMessage("The passwords do not match.");
      return;
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      setIsError(true);
      setMessage(
        "The invitation session is missing or has expired. Please request a new invitation.",
      );
      return;
    }

    setSaving(true);

    const { error: passwordError } = await supabase.auth.updateUser({
      password,
    });

    if (passwordError) {
      setSaving(false);
      setIsError(true);
      setMessage(passwordError.message);
      return;
    }

    const activationResult =
      await authenticatedApiRequest<CompleteActivationResponse>(
        "/api/account/complete-activation",
      );

    if (activationResult.unauthenticated) {
      setSaving(false);
      setIsError(true);
      setMessage(
        "Your password was saved, but the invitation session expired before the profile could be activated. Please sign in using your new password or request a new invitation.",
      );
      return;
    }

    if (!activationResult.ok) {
      setSaving(false);
      setIsError(true);
      setMessage(
        activationResult.error
          ? `Your password was saved, but your profile could not be activated: ${activationResult.error}`
          : "Your password was saved, but your profile could not be activated.",
      );
      return;
    }

    if (!activationResult.data || !activationResult.data.profileActivated) {
      setSaving(false);
      setIsError(true);
      setMessage(
        activationResult.data?.error ||
          "Your password was saved, but the activation service did not activate your profile.",
      );
      return;
    }

    setSaving(false);
    setIsError(false);
    setMessage(
      activationResult.data.message ||
        "Your password has been created and your account is now active.",
    );

    window.dispatchEvent(new Event("profile-updated"));

    window.setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1200);
  }

  if (checkingSession) {
    return <LoadingScreen message="Checking your invitation..." />;
  }

  return (
    <CustomerPageLayout>
      <PageCard
        title="Set Your Password"
        subtitle="Complete your Browns Boarding account setup."
      >
        <div className="mx-auto max-w-xl">
          {!sessionAvailable ? (
            <div className="space-y-4">
              <MessageBox type="error">
                This invitation link is invalid or has expired. Please contact
                Browns Boarding for a new invitation.
              </MessageBox>

              <div className="flex justify-center">
                <Button href="/login">Return to Login</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSetPassword} className="space-y-5">
              <FormInput
                id="password"
                label="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />

              <FormInput
                id="confirmPassword"
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />

              <p className="text-sm text-[#8B6A4E]">
                Your password must contain at least 8 characters.
              </p>

              {message && (
                <MessageBox type={isError ? "error" : "success"}>
                  {message}
                </MessageBox>
              )}

              <div className="flex justify-center">
                <Button
                  type="submit"
                  variant="dark"
                  disabled={saving}
                  className="disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                >
                  {saving
                    ? "Creating Account..."
                    : "Set Password & Activate Account"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </PageCard>
    </CustomerPageLayout>
  );
}
