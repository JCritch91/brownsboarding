"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { ensureActiveAdminUser } from "@/lib/appActions";
import { formatName, validateDogDetails } from "@/lib/helpers";

import AdminPageLayout from "@/components/AdminPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import LoadingScreen from "@/components/LoadingScreen";
import DogForm, { type DogFormValues } from "@/components/dogs/DogForm";
import { authenticatedApiRequest } from "@/lib/client/authenticated-api";

type CreateAdminDogResponse = {
  success: boolean;
  dogCreated: boolean;
  dog?: {
    id: string;
    ownerId: string;
    name: string;
    active: boolean;
    meetAndGreetCompleted: boolean;
  };
  message?: string;
  error?: string;
};

const emptyForm: DogFormValues = {
  name: "",
  breed: "",
  date_of_birth: "",
  weight_kg: "",
  gender: "",
  neutered: "",
  vaccinated: "",
  vaccination_expiry: "",
  microchip_number: "",
  vet_name: "",
  vet_phone: "",
  vet_address: "",
  medical_notes: "",
  medication_notes: "",
  feeding_notes: "",
  behaviour_notes: "",
};

export default function AdminAddDogPage() {
  const params = useParams<{
    customerId: string;
  }>();

  const customerId = params.customerId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customerName, setCustomerName] = useState("Customer");

  const [form, setForm] = useState<DogFormValues>(emptyForm);

  const [meetAndGreetCompleted, setMeetAndGreetCompleted] = useState(false);

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
        email
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

    const firstName = formatName(data.first_name || "");

    const lastName = formatName(data.last_name || "");

    const fullName = `${firstName} ${lastName}`.trim();

    setCustomerName(fullName || data.email || "Customer");

    setLoading(false);
  }

  function updateField(field: keyof DogFormValues, value: string) {
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

    const validationMessage = validateDogDetails(form);

    if (validationMessage) {
      setIsError(true);
      setMessage(validationMessage);
      return;
    }

    setSaving(true);

    const result = await authenticatedApiRequest<CreateAdminDogResponse>(
      `/api/admin/customers/${customerId}/dogs/create`,
      {
        body: {
          ...form,
          meetAndGreetCompleted,
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
      setMessage(result.error || "The dog could not be added.");
      return;
    }

    if (!result.data || !result.data.dogCreated) {
      setIsError(true);
      setMessage(
        result.data?.error || "The dog service did not create the dog.",
      );
      return;
    }

    setIsError(false);

    window.location.href = `/admin/customers/${customerId}`;
  }

  if (loading) {
    return <LoadingScreen message="Loading customer..." />;
  }

  return (
    <AdminPageLayout>
      <PageCard
        title="Add Dog"
        subtitle={`Create a new dog profile for ${customerName}.`}
        actions={
          <Button href={`/admin/customers/${customerId}`}>
            Back to Customer
          </Button>
        }
      >
        <DogForm
          form={form}
          onChange={updateField}
          onSubmit={handleSave}
          saving={saving}
          message={message}
          isError={isError}
          submitLabel="Add Dog"
          savingLabel="Adding Dog..."
          cancelHref={`/admin/customers/${customerId}`}
          meetAndGreetCompleted={meetAndGreetCompleted}
          allowMeetAndGreetManagement={true}
          onMeetAndGreetChange={setMeetAndGreetCompleted}
        />
      </PageCard>
    </AdminPageLayout>
  );
}
