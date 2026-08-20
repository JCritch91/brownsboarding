"use client";

import { useState, type FormEvent } from "react";

import { supabase } from "@/lib/supabase";
import {
  formatAddressLine,
  formatEmail,
  formatName,
  formatPostcode,
  formatUkPhone,
} from "@/lib/helpers";

import AuthLayout from "@/components/AuthLayout";
import Button from "@/components/Buttons";
import MessageBox from "@/components/MessageBox";
import { FormInput } from "@/components/FormInput";

type PrepareAccountActivationResponse = {
  success: boolean;
  profilePrepared: boolean;
  activationEmailSent: boolean;
  followUpRequired: boolean;
  profile?: {
    id: string;
    email: string;
  };
  message?: string;
  error?: string;
};

export default function SignupPage() {
  const [firstName, setFirstName] = useState("");

  const [lastName, setLastName] = useState("");

  const [phone, setPhone] = useState("");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");

  const [address1, setAddress1] = useState("");

  const [address2, setAddress2] = useState("");

  const [town, setTown] = useState("");

  const [postcode, setPostcode] = useState("");

  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setMessage("");

    const formattedFirstName = formatName(firstName);

    const formattedLastName = formatName(lastName);

    const formattedPhone = formatUkPhone(phone);

    const formattedEmail = formatEmail(email);

    const formattedAddress1 = formatAddressLine(address1);

    const formattedAddress2 = formatAddressLine(address2);

    const formattedTown = formatName(town);

    const formattedPostcode = formatPostcode(postcode);

    if (!formattedFirstName) {
      setMessage("Please enter your first name.");
      return;
    }

    if (!formattedLastName) {
      setMessage("Please enter your last name.");
      return;
    }

    if (!formattedEmail) {
      setMessage("Please enter your email address.");
      return;
    }

    if (!formattedAddress1) {
      setMessage("Please enter the first line of your address.");
      return;
    }

    if (!formattedTown) {
      setMessage("Please enter your town.");
      return;
    }

    if (!formattedPostcode) {
      setMessage("Please enter your postcode.");
      return;
    }

    if (password.length < 8) {
      setMessage("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    const phoneRegex = /^(\+44\s?7\d{3}|07\d{3})\s?\d{3}\s?\d{3}$/;

    if (!phoneRegex.test(formattedPhone)) {
      setMessage(
        "Please enter a valid UK phone number, for example 07123 456789.",
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formattedEmail,
        password,
        options: {
          data: {
            first_name: formattedFirstName,
            last_name: formattedLastName,
            phone: formattedPhone,
            address1: formattedAddress1,
            address2: formattedAddress2,
            town: formattedTown,
            postcode: formattedPostcode,
          },
        },
      });

      if (error) {
        setMessage(error.message || "Signup failed. Please try again.");
        return;
      }

      if (!data.user) {
        setMessage("Account created, but user details could not be loaded.");
        return;
      }

      if (!data.session?.access_token) {
        setMessage(
          "The account was created, but the signup session could not be established. Please contact Browns Boarding.",
        );
        return;
      }

      const activationResponse = await fetch(
        "/api/prepare-account-activation",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
          },
        },
      );

      const activationResult = (await activationResponse
        .json()
        .catch(() => null)) as PrepareAccountActivationResponse | null;

      if (!activationResponse.ok) {
        setMessage(
          activationResult?.error ||
            "Account created, but activation could not be prepared. Please contact Browns Boarding.",
        );
        return;
      }

      if (!activationResult || !activationResult.profilePrepared) {
        setMessage(
          activationResult?.error ||
            "Account created, but the activation service did not prepare the customer profile.",
        );
        return;
      }

      if (
        activationResult.followUpRequired ||
        !activationResult.activationEmailSent
      ) {
        await supabase.auth.signOut();

        setMessage(
          activationResult.message ||
            "Your account was created, but the activation email could not be sent. Please request a new activation email.",
        );
        return;
      }

      await supabase.auth.signOut();

      window.location.href = "/login?registered=true&activation=true";
    } catch (error) {
      console.error("Unexpected signup error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred during signup.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Create Account"
      subtitle="(All fields marked with * are mandatory)"
      maxWidth="max-w-4xl"
    >
      {" "}
      {message && <MessageBox type="error">{message}</MessageBox>}
      <form onSubmit={handleSignup} className="space-y-4 md:space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <FormInput
            id="firstName"
            label="First Name*"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />

          <FormInput
            id="lastName"
            label="Last Name*"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormInput
            id="phone"
            label="Contact Number*"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07123 456789"
            required
          />

          <FormInput
            id="postcode"
            label="Postcode*"
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            required
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          <FormInput
            id="address1"
            label="Address Line 1*"
            type="text"
            value={address1}
            onChange={(e) => setAddress1(e.target.value)}
            required
          />

          <FormInput
            id="address2"
            label="Address Line 2"
            type="text"
            value={address2}
            onChange={(e) => setAddress2(e.target.value)}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          <FormInput
            id="town"
            label="Town / City*"
            type="text"
            value={town}
            onChange={(e) => setTown(e.target.value)}
            required
          />

          <FormInput
            id="email"
            label="Email Address*"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormInput
            id="password"
            label="Password*"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <FormInput
            id="confirmPassword"
            label="Confirm Password*"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <Button type="submit" disabled={loading} className="mx-auto w-fit">
          {loading ? "Creating Account..." : "Create Account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
