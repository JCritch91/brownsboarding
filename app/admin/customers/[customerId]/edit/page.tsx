"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";

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
import { authenticatedApiRequest } from "@/lib/client/authenticated-api";

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

type UpdateCustomerResponse = {
  success: boolean;
  customerUpdated: boolean;
  customer?: {
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
    is_admin: boolean | null;
  };
  message?: string;
  error?: string;
};

export default function EditAdminCustomerPage() {
  const params = useParams<{ customerId: string }>();
  const customerId = params.customerId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<CustomerFormValues>(emptyForm);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    checkAdminAndLoadCustomer();
  }, [customerId]);

  async function checkAdminAndLoadCustomer() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    const { redirectTo } = await ensureActiveAdminUser();

    if (redirectTo) {
      window.location.href = redirectTo;
      return;
    }

    await loadCustomer();
  }

  async function loadCustomer() {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        `
        id,
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
      .eq("id", customerId)
      .or("is_admin.eq.false,is_admin.is.null")
      .maybeSingle();

    if (error) {
      setIsError(true);
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setIsError(true);
      setMessage("Customer could not be found.");
      setLoading(false);
      return;
    }

    setForm({
      first_name: formatName(data.first_name || ""),
      last_name: formatName(data.last_name || ""),
      email: formatEmail(data.email || ""),
      phone: formatUkPhone(data.phone || ""),
      address_line_1: formatAddressLine(data.address_line_1 || ""),
      address_line_2: formatAddressLine(data.address_line_2 || ""),
      town: formatName(data.town || ""),
      postcode: formatPostcode(data.postcode || ""),
      emergency_contact_name: formatName(data.emergency_contact_name || ""),
      emergency_contact_phone: formatUkPhone(
        data.emergency_contact_phone || "",
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

    const result = await authenticatedApiRequest<UpdateCustomerResponse>(
      `/api/admin/customers/${customerId}/update`,
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
      setMessage(result.error || "The customer details could not be updated.");
      return;
    }

    if (!result.data || !result.data.customerUpdated) {
      setIsError(true);
      setMessage(
        result.data?.error ||
          "The customer service did not update the customer.",
      );
      return;
    }

    setIsError(false);

    window.location.href = `/admin/customers/${customerId}`;
  }

  if (loading) {
    return <LoadingScreen message="Loading customer details..." />;
  }

  return (
    <AdminPageLayout>
      <PageCard
        title="Edit Customer"
        subtitle="Update the customer's contact, address and emergency details."
        actions={
          <Button href={`/admin/customers/${customerId}`}>
            Back to Customer
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
          submitLabel="Save Customer"
          savingLabel="Saving Customer..."
          cancelHref={`/admin/customers/${customerId}`}
          emailDisabled={true}
        />
      </PageCard>
    </AdminPageLayout>
  );
}
