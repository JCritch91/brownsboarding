"use client";

import { useEffect, useState, type FormEvent } from "react";

import { supabase } from "@/lib/supabase";
import { ensureActiveAdminUser } from "@/lib/appActions";
import {
  formatAddressLine,
  formatEmail,
  formatName,
  formatPostcode,
  formatUkPhone,
} from "@/lib/helpers";

import AdminPageLayout from "@/components/AdminPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import LoadingScreen from "@/components/LoadingScreen";
import CustomerForm, {
  type CustomerFormValues,
} from "@/components/customer/CustomerForm";

const emptyForm: CustomerFormValues = {
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
};

export default function AdminAddCustomerPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<CustomerFormValues>(emptyForm);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    const { redirectTo } = await ensureActiveAdminUser();

    if (redirectTo) {
      window.location.href = redirectTo;
      return;
    }

    setLoading(false);
  }

  function updateField(field: keyof CustomerFormValues, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaving(true);
    setMessage("");
    setIsError(false);

    const firstName = formatName(form.first_name);
    const lastName = formatName(form.last_name);
    const email = formatEmail(form.email);

    if (!firstName || !lastName || !email) {
      setSaving(false);
      setIsError(true);
      setMessage("First name, last name and email address are required.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      setSaving(false);
      setIsError(true);
      setMessage("Please enter a valid email address.");
      return;
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      setSaving(false);
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/admin/customers/create", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email,
        phone: formatUkPhone(form.phone),
        address_line_1: formatAddressLine(form.address_line_1),
        address_line_2: formatAddressLine(form.address_line_2),
        town: formatName(form.town),
        postcode: formatPostcode(form.postcode),
        emergency_contact_name: formatName(form.emergency_contact_name),
        emergency_contact_phone: formatUkPhone(form.emergency_contact_phone),
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setSaving(false);
      setIsError(true);
      setMessage(result?.error || "Unable to create the customer.");
      return;
    }

    if (!result?.customerId) {
      setSaving(false);
      setIsError(true);
      setMessage("The customer was created, but no customer ID was returned.");
      return;
    }

    window.location.href = `/admin/customers/${result.customerId}`;
  }

  if (loading) {
    return <LoadingScreen message="Preparing customer form..." />;
  }

  return (
    <AdminPageLayout>
      <PageCard
        title="Add Customer"
        subtitle="Create a customer account and send an invitation to set up their password."
        actions={<Button href="/admin/customers">Back to Customers</Button>}
      >
        <CustomerForm
          form={form}
          onChange={updateField}
          onSubmit={handleSubmit}
          saving={saving}
          message={message}
          isError={isError}
          submitLabel="Create Customer"
          savingLabel="Creating Customer..."
          cancelHref="/admin/customers"
          emailDisabled={false}
        />
      </PageCard>
    </AdminPageLayout>
  );
}
