"use client";

import {
  useState,
  type FormEvent,
} from "react";

import { supabase } from "@/lib/supabase";
import {
  getCurrentUser,
} from "@/lib/appActions";
import {
  formatName,
  validateDogDetails,
} from "@/lib/helpers";

import CustomerPageLayout from "@/components/CustomerPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import DogForm, {
  type DogFormValues,
} from "@/components/dogs/DogForm";

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
  medical_notes: "",
  medication_notes: "",
  feeding_notes: "",
  behaviour_notes: "",
};

export default function AddDogPage() {
  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [isError, setIsError] =
    useState(false);

  const [form, setForm] =
    useState<DogFormValues>(emptyForm);

  function updateField(
    field: keyof DogFormValues,
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

    if (saving) {
      return;
    }

    setMessage("");
    setIsError(false);

    const validationMessage =
      validateDogDetails(form);

    if (validationMessage) {
      setIsError(true);
      setMessage(validationMessage);
      return;
    }

    setSaving(true);

    let user;

    try {
      user = await getCurrentUser();
    } catch {
      setSaving(false);
      window.location.href = "/login";
      return;
    }

    const { error } = await supabase
      .from("dogs")
      .insert({
        owner_id: user.id,
        name: formatName(form.name),
        breed:
          formatName(form.breed) || null,
        date_of_birth:
          form.date_of_birth || null,
        weight_kg: form.weight_kg
          ? Number(form.weight_kg)
          : null,
        gender: form.gender || null,
        neutered:
          form.neutered === "yes",
        vaccinated:
          form.vaccinated === "yes",
        vaccination_expiry:
          form.vaccinated === "yes"
            ? form.vaccination_expiry ||
              null
            : null,
        microchip_number:
          form.microchip_number.trim() ||
          null,
        medical_notes:
          form.medical_notes.trim() ||
          null,
        medication_notes:
          form.medication_notes.trim() ||
          null,
        feeding_notes:
          form.feeding_notes.trim() ||
          null,
        behaviour_notes:
          form.behaviour_notes.trim() ||
          null,
        active: true,
        meet_and_greet_completed: false,
        updated_at:
          new Date().toISOString(),
      });

    setSaving(false);

    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }

    window.location.href = "/my-dogs";
  }

  return (
  <CustomerPageLayout>
    <PageCard
      title="Add Dog"
      subtitle="Create a profile for your dog before requesting a booking."
      actions={
        <Button href="/my-dogs">
          Back to My Dogs
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