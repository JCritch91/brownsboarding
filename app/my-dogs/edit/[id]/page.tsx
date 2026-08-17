"use client";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useParams } from "next/navigation";

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
import LoadingScreen from "@/components/LoadingScreen";
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

export default function EditDogPage() {
  const params = useParams<{
    id: string;
  }>();

  const dogId = params.id;

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [isError, setIsError] =
    useState(false);

  const [
    meetAndGreetCompleted,
    setMeetAndGreetCompleted,
  ] = useState(false);

  const [form, setForm] =
    useState<DogFormValues>(emptyForm);

  useEffect(() => {
    loadDog();
  }, [dogId]);

  async function loadDog() {
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
      .from("dogs")
      .select(
        `
        id,
        owner_id,
        name,
        breed,
        date_of_birth,
        weight_kg,
        gender,
        neutered,
        vaccinated,
        vaccination_expiry,
        microchip_number,
        medical_notes,
        medication_notes,
        feeding_notes,
        behaviour_notes,
        meet_and_greet_completed,
        active
        `
      )
      .eq("id", dogId)
      .eq("owner_id", user.id)
      .eq("active", true)
      .maybeSingle();

    if (error) {
      setIsError(true);
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setIsError(true);
      setMessage(
        "This dog could not be found or is no longer active."
      );
      setLoading(false);
      return;
    }

    setMeetAndGreetCompleted(
      Boolean(
        data.meet_and_greet_completed
      )
    );

    setForm({
      name: data.name || "",
      breed: data.breed || "",
      date_of_birth:
        data.date_of_birth || "",
      weight_kg:
        data.weight_kg !== null
          ? String(data.weight_kg)
          : "",
      gender: data.gender || "",
      neutered:
        data.neutered === null
          ? ""
          : data.neutered
            ? "yes"
            : "no",
      vaccinated:
        data.vaccinated === null
          ? ""
          : data.vaccinated
            ? "yes"
            : "no",
      vaccination_expiry:
        data.vaccination_expiry || "",
      microchip_number:
        data.microchip_number || "",
      medical_notes:
        data.medical_notes || "",
      medication_notes:
        data.medication_notes || "",
      feeding_notes:
        data.feeding_notes || "",
      behaviour_notes:
        data.behaviour_notes || "",
    });

    setLoading(false);
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

    const { data: updatedDog, error } =
      await supabase
        .from("dogs")
        .update({
          name: formatName(form.name),
          breed:
            formatName(form.breed) ||
            null,
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
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", dogId)
        .eq("owner_id", user.id)
        .eq("active", true)
        .select("id")
        .maybeSingle();

    setSaving(false);

    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }

    if (!updatedDog) {
      setIsError(true);
      setMessage(
        "This dog could not be updated because it was not found or is no longer active."
      );
      return;
    }

    window.location.href = "/my-dogs";
  }

  if (loading) {
    return (
      <LoadingScreen message="Loading dog details..." />
    );
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
        {isError &&
        message ===
          "This dog could not be found or is no longer active." ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-800 md:p-4 md:text-base">
              {message}
            </div>

            <div className="flex justify-center">
              <Button href="/my-dogs">
                Return to My Dogs
              </Button>
            </div>
          </div>
        ) : (
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
        )}
      </PageCard>
    </CustomerPageLayout>
  );
}
