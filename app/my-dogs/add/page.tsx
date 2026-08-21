"use client";

import { useState, type FormEvent } from "react";

import { validateDogDetails } from "@/lib/helpers";

import CustomerPageLayout from "@/components/CustomerPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import DogForm, { type DogFormValues } from "@/components/dogs/DogForm";
import { authenticatedApiRequest } from "@/lib/client/authenticated-api";

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

type CreateDogResponse = {
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

export default function AddDogPage() {
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");

  const [isError, setIsError] = useState(false);

  const [form, setForm] = useState<DogFormValues>(emptyForm);

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

    const result = await authenticatedApiRequest<CreateDogResponse>(
      "/api/dogs/create",
      {
        body: form,
      },
    );

    setSaving(false);

    if (result.unauthenticated) {
      window.location.href = "/login";
      return;
    }

    if (!result.ok) {
      setIsError(true);
      setMessage(result.error || "Your dog could not be added.");
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

    window.location.href = "/my-dogs";
  }

  return (
    <CustomerPageLayout>
      <PageCard
        title="Add Dog"
        subtitle="Create a profile for your dog before requesting a booking."
        actions={<Button href="/my-dogs">Back to My Dogs</Button>}
      >
        <DogForm
          form={form}
          onChange={updateField}
          onSubmit={handleSave}
          saving={saving}
          message={message}
          isError={isError}
          submitLabel="Save"
          savingLabel="Saving..."
          cancelHref="/my-dogs"
          meetAndGreetCompleted={false}
          allowMeetAndGreetManagement={false}
        />
      </PageCard>
    </CustomerPageLayout>
  );
}
