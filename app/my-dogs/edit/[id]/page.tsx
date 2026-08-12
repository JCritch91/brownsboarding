"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/appActions";

import CustomerPageLayout from "@/components/CustomerPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import { formatName, validateDogDetails } from "@/lib/helpers";
import DogForm, {
  type DogFormValues,
} from "@/components/dogs/DogForm";

export default function EditDogPage() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [meetAndGreetCompleted, setMeetAndGreetCompleted] =
  useState(false);

  const params = useParams();
  const dogId = params.id as string;

  const [form, setForm] = useState<DogFormValues>({
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
  });

  useEffect(() => {
    loadDog();
  }, []);

  async function loadDog() {
    const { data, error } = await supabase
      .from("dogs")
      .select("*")
      .eq("id", dogId)
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    setMeetAndGreetCompleted(
      Boolean(data.meet_and_greet_completed)
    );


    setForm({
      name: data.name || "",
      breed: data.breed || "",
      date_of_birth: data.date_of_birth || "",
      weight_kg: data.weight_kg?.toString() || "",
      gender: data.gender || "",
      neutered: data.neutered ? "yes" : "no",
      vaccinated: data.vaccinated ? "yes" : "no",
      vaccination_expiry: data.vaccination_expiry || "",
      microchip_number: data.microchip_number || "",
      medical_notes: data.medical_notes || "",
      medication_notes: data.medication_notes || "",
      feeding_notes: data.feeding_notes || "",
      behaviour_notes: data.behaviour_notes || "",
    });
  }

function updateField(
  field: keyof DogFormValues,
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

    const validationMessage = validateDogDetails(form);

    if (validationMessage) {
      setMessage(validationMessage);
      setSaving(false);
      return;
    }

    let user;

    try {
      user = await getCurrentUser();
    } catch {
      window.location.href = "/login";
      return;
    }

    const { error } = await supabase
      .from("dogs")
      .update({
        owner_id: user.id,
        name: formatName(form.name),
        breed: formatName(form.breed),
        date_of_birth: form.date_of_birth || null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        gender: form.gender || null,
        neutered: form.neutered === "yes",
        vaccinated: form.vaccinated === "yes",
        vaccination_expiry: form.vaccination_expiry || null,
        microchip_number: form.microchip_number.trim(),
        medical_notes: form.medical_notes.trim(),
        medication_notes: form.medication_notes.trim(),
        feeding_notes: form.feeding_notes.trim(),
        behaviour_notes: form.behaviour_notes.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", dogId)
      .eq("owner_id", user.id);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    window.location.href = "/my-dogs";
  }

  return (
    <CustomerPageLayout>
      <PageCard
        title="Edit Dog"
        subtitle="Update your dog's details, care information and boarding requirements."
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
          isError={Boolean(message)}
          submitLabel="Save Changes"
          savingLabel="Saving Changes..."
          cancelHref="/my-dogs"
          meetAndGreetCompleted={meetAndGreetCompleted}
        />
      </PageCard>
    </CustomerPageLayout>
  );
}