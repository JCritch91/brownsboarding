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

export default function MyDetailsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const [userId, setUserId] = useState("");

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
  vet_name: "",
  vet_phone: "",
  vet_address: "",
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

    setUserId(user.id);

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
        emergency_contact_phone,
        vet_name,
        vet_phone,
        vet_address
        `
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
        data?.emergency_contact_phone || ""
      ),
      vet_name: formatName(data?.vet_name || ""),
      vet_phone: formatUkPhone(data?.vet_phone || ""),
      vet_address: formatAddressLine(data?.vet_address || ""),
    });

    setLoading(false);
  }

  function updateField(
    field: keyof CustomerFormValues,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]:value,
    }));
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSaving(true);
    setMessage("");
    setIsError(false);

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: formatName(form.first_name),
        last_name: formatName(form.last_name),
        phone: formatUkPhone(form.phone),
        address_line_1: formatAddressLine(form.address_line_1),
        address_line_2: formatAddressLine(form.address_line_2),
        town: formatName(form.town),
        postcode: formatPostcode(form.postcode),
        emergency_contact_name: formatName(form.emergency_contact_name),
        emergency_contact_phone: formatUkPhone(form.emergency_contact_phone),
        vet_name: formatName(form.vet_name),
        vet_phone: formatUkPhone(form.vet_phone),
        vet_address: formatAddressLine(form.vet_address),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    setSaving(false);

    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }

    setIsError(false);
    setMessage("Details saved successfully.");
    window.dispatchEvent(new Event("profile-updated"));
  }

  async function deleteAccount() {
    const confirmed = window.confirm(
      "Are you sure you want to delete your account?\n\nYour account and dogs will be made inactive. Historic information will be retained by Browns Boarding."
    );

    if (!confirmed) return;

    setMessage("");
    setIsError(false);

    let user;

    try {
      user = await getCurrentUser();
    } catch {
      window.location.href = "/login";
      return;
    }

    const { data: bookings, error: bookingError } = await supabase
      .from("bookings")
      .select("id")
      .eq("owner_id", user.id)
      .in("status", ["Pending", "Confirmed"]);

    if (bookingError) {
      setIsError(true);
      setMessage(bookingError.message);
      return;
    }

    if (bookings && bookings.length > 0) {
      setIsError(true);
      setMessage(
        "Your account cannot be deleted because you have pending or confirmed bookings. Please cancel those bookings first."
      );
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileError) {
      setIsError(true);
      setMessage(profileError.message);
      return;
    }

    const { error: dogError } = await supabase
      .from("dogs")
      .update({
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("owner_id", user.id);

    if (dogError) {
      setIsError(true);
      setMessage(dogError.message);
      return;
    }

    await supabase.auth.signOut();

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
        actions={
          <Button href="/dashboard">
            Back to Dashboard
          </Button>
        }
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
          showVetDetails
          additionalActions={
          <button
            type="button"
            onClick={deleteAccount}
            disabled={saving}
            className="inline-flex min-h-11 w-fit items-center justify-center rounded-lg border border-red-500 px-4 py-2 text-sm font-semibold text-red-600 transition-all duration-300 hover:scale-105 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 md:px-8 md:py-3 md:text-base"
          >
            Delete Account
          </button>
          }
          />
              </PageCard>
            </CustomerPageLayout>
          );
        }