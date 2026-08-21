"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/appActions";
import {
  formatName,
  formatAddressLine,
  formatPostcode,
  formatEmail,
  formatUkPhone,
} from "@/lib/helpers";

import CustomerForm, {
  type CustomerFormValues,
} from "@/components/customer/CustomerForm";

import CustomerPageLayout from "@/components/CustomerPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import LoadingScreen from "@/components/LoadingScreen";
import { authenticatedApiRequest } from "@/lib/client/authenticated-api";
import ConfirmationModal from "@/components/modals/ConfirmationModal";

type DeactivateAccountResponse = {
  success: boolean;
  accountDeactivated: boolean;
  customerId: string;
  deactivatedDogs: number;
  message?: string;
  error?: string;
};

type UpdateProfileResponse = {
  success: boolean;
  profileUpdated: boolean;
  profile?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    address_line_1: string | null;
    address_line_2: string | null;
    town: string | null;
    postcode: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    active: boolean;
  };
  message?: string;
  error?: string;
};

export default function MyDetailsPage() {
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeactivateAccountModal, setShowDeactivateAccountModal] =
    useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const [form, setForm] = useState<CustomerFormValues>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address_line_1: "",
    address_line_2: "",
    town: "",
    postcode: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    let user;

    try {
      user = await getCurrentUser();
    } catch {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(
        `
        first_name,
        last_name,
        email,
        phone,
        address_line_1,
        address_line_2,
        town,
        postcode,
        emergency_contact_name,
        emergency_contact_phone
        `,
      )
      .eq("id", user.id)
      .single();

    if (error) {
      setIsError(true);
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setForm({
      first_name: formatName(data?.first_name || ""),
      last_name: formatName(data?.last_name || ""),
      email: formatEmail(data?.email || user.email || ""),
      phone: formatUkPhone(data?.phone || ""),
      address_line_1: formatAddressLine(data?.address_line_1 || ""),
      address_line_2: formatAddressLine(data?.address_line_2 || ""),
      town: formatName(data?.town || ""),
      postcode: formatPostcode(data?.postcode || ""),
      emergency_contact_name: data?.emergency_contact_name || "",
      emergency_contact_phone: formatUkPhone(
        data?.emergency_contact_phone || "",
      ),
    });

    setLoading(false);
  }

  function updateField(field: keyof CustomerFormValues, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setMessage("");
    setIsError(false);

    const firstName = formatName(form.first_name);

    const lastName = formatName(form.last_name);

    if (!firstName || !lastName) {
      setIsError(true);
      setMessage("First name and last name are required.");
      return;
    }

    setSaving(true);

    const result = await authenticatedApiRequest<UpdateProfileResponse>(
      "/api/profile/update",
      {
        method: "PATCH",
        body: {
          ...form,
          first_name: firstName,
          last_name: lastName,
        },
      },
    );

    setSaving(false);

    if (result.unauthenticated) {
      window.location.href = "/login";
      return;
    }

    if (!result.ok) {
      setIsError(true);
      setMessage(result.error || "Your details could not be updated.");
      return;
    }

    if (!result.data || !result.data.profileUpdated) {
      setIsError(true);
      setMessage(
        result.data?.error ||
          "The profile service did not update your details.",
      );
      return;
    }

    setIsError(false);
    setMessage(
      result.data.message || "Your details have been updated successfully.",
    );

    if (result.data.profile) {
      setForm({
        first_name: result.data.profile.first_name || "",
        last_name: result.data.profile.last_name || "",
        email: result.data.profile.email || "",
        phone: result.data.profile.phone || "",
        address_line_1: result.data.profile.address_line_1 || "",
        address_line_2: result.data.profile.address_line_2 || "",
        town: result.data.profile.town || "",
        postcode: result.data.profile.postcode || "",
        emergency_contact_name:
          result.data.profile.emergency_contact_name || "",
        emergency_contact_phone:
          result.data.profile.emergency_contact_phone || "",
      });
    }
  }

  function requestAccountDeactivation() {
    if (deletingAccount) {
      return;
    }

    setMessage("");
    setIsError(false);
    setShowDeactivateAccountModal(true);
  }

  async function deactivateAccount() {
    if (deletingAccount) {
      return;
    }

    setDeletingAccount(true);

    const result = await authenticatedApiRequest<DeactivateAccountResponse>(
      "/api/profile/deactivate",
    );

    if (result.unauthenticated) {
      setDeletingAccount(false);
      setShowDeactivateAccountModal(false);
      window.location.href = "/login";
      return;
    }

    if (!result.ok) {
      setDeletingAccount(false);
      setShowDeactivateAccountModal(false);
      setIsError(true);
      setMessage(result.error || "Your account could not be deactivated.");
      return;
    }

    if (!result.data || !result.data.accountDeactivated) {
      setDeletingAccount(false);
      setShowDeactivateAccountModal(false);
      setIsError(true);
      setMessage(
        result.data?.error ||
          "The account service did not deactivate your account.",
      );
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut();

    setDeletingAccount(false);
    setShowDeactivateAccountModal(false);

    if (signOutError) {
      setIsError(true);
      setMessage(
        "Your account was deleted, but the local session could not be cleared. Please close the browser or return to the login page.",
      );
      return;
    }

    window.location.href = "/";
  }

  if (loading) {
    return <LoadingScreen message="Loading your details..." />;
  }

  return (
    <CustomerPageLayout>
      <PageCard
        title="My Details"
        subtitle="Keep your contact and emergency information up to date."
        actions={<Button href="/dashboard">Back to Dashboard</Button>}
      >
        <CustomerForm
          form={form}
          onChange={updateField}
          onSubmit={handleSave}
          saving={saving}
          message={message}
          isError={isError}
          submitLabel="Save Details"
          savingLabel="Saving..."
          cancelHref="/dashboard"
          emailDisabled
          additionalActions={
            <button
              type="button"
              onClick={requestAccountDeactivation}
              disabled={deletingAccount}
              className="inline-flex min-h-11 w-fit cursor-pointer items-center justify-center rounded-lg border border-red-400 px-4 py-2 text-sm font-semibold text-red-600 transition-all duration-300 hover:scale-105 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 md:text-base"
            >
              Delete Account
            </button>
          }
        />
      </PageCard>

      <ConfirmationModal
        isOpen={showDeactivateAccountModal}
        title="Delete Account"
        confirmText="Delete Account"
        cancelText="Keep Account"
        isConfirming={deletingAccount}
        variant="danger"
        onConfirm={deactivateAccount}
        onCancel={() => {
          if (!deletingAccount) {
            setShowDeactivateAccountModal(false);
          }
        }}
      >
        <div className="space-y-4">
          <p>
            Please confirm that you want to delete your Browns Boarding account.
          </p>

          <div className="rounded-xl border border-[#D9CBB8] bg-[#FFFDF9] p-4">
            <p className="font-semibold text-[#5C4033]">
              Deleting your account will:
            </p>

            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Prevent access to the customer portal.</li>
              <li>Make all dogs associated with the account inactive.</li>
              <li>Prevent new bookings from being requested.</li>
              <li>Sign the account out after deactivation.</li>
            </ul>
          </div>

          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800">
            Historical booking information will be retained for business and
            accounting records.
          </div>
        </div>
      </ConfirmationModal>
    </CustomerPageLayout>
  );
}
