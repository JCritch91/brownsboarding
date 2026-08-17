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
  vet_name: "",
  vet_phone: "",
  vet_address: "",
};

export default function EditAdminCustomerPage() {
  const params = useParams<{ customerId: string }>();
  const customerId = params.customerId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] =
    useState<CustomerFormValues>(emptyForm);

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
        emergency_contact_phone,
        vet_name,
        vet_phone,
        vet_address
        `
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
      address_line_1: formatAddressLine(
        data.address_line_1 || ""
      ),
      address_line_2: formatAddressLine(
        data.address_line_2 || ""
      ),
      town: formatName(data.town || ""),
      postcode: formatPostcode(data.postcode || ""),
      emergency_contact_name: formatName(
        data.emergency_contact_name || ""
      ),
      emergency_contact_phone: formatUkPhone(
        data.emergency_contact_phone || ""
      ),
      vet_name: formatName(data.vet_name || ""),
      vet_phone: formatUkPhone(data.vet_phone || ""),
      vet_address: formatAddressLine(
        data.vet_address || ""
      ),
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

  async function handleSave(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setIsError(false);

    const firstName = formatName(form.first_name);
    const lastName = formatName(form.last_name);

    if (!firstName || !lastName) {
      setSaving(false);
      setIsError(true);
      setMessage("First name and last name are required.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: formatUkPhone(form.phone),
        address_line_1: formatAddressLine(
          form.address_line_1
        ),
        address_line_2: formatAddressLine(
          form.address_line_2
        ),
        town: formatName(form.town),
        postcode: formatPostcode(form.postcode),
        emergency_contact_name: formatName(
          form.emergency_contact_name
        ),
        emergency_contact_phone: formatUkPhone(
          form.emergency_contact_phone
        ),
        vet_name: formatName(form.vet_name),
        vet_phone: formatUkPhone(form.vet_phone),
        vet_address: formatAddressLine(form.vet_address),
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);

    setSaving(false);

    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }

    window.location.href = `/admin/customers/${customerId}`;
  }

  if (loading) {
    return <LoadingScreen message="Loading customer details..." />;
  }

  return (
    <AdminPageLayout>
      <PageCard
        title="Edit Customer"
        subtitle="Update the customer's contact, emergency and veterinary details."
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
          showVetDetails={true}
        />
      </PageCard>
    </AdminPageLayout>
  );
}