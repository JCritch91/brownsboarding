"use client";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useParams } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { ensureActiveAdminUser } from "@/lib/appActions";
import {
  formatName,
  validateDogDetails,
} from "@/lib/helpers";

import AdminPageLayout from "@/components/AdminPageLayout";
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

export default function AdminEditDogPage() {
  const params = useParams<{
    customerId: string;
    dogId: string;
  }>();

  const customerId = params.customerId;
  const dogId = params.dogId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] =
    useState<DogFormValues>(emptyForm);

  const [dogActive, setDogActive] = useState(true);

  const [
    meetAndGreetCompleted,
    setMeetAndGreetCompleted,
  ] = useState(false);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    checkAdminAndLoadDog();
  }, [customerId, dogId]);

  async function checkAdminAndLoadDog() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    const { redirectTo } =
      await ensureActiveAdminUser();

    if (redirectTo) {
      window.location.href = redirectTo;
      return;
    }

    await loadDog();
  }

  async function loadDog() {
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
      .eq("owner_id", customerId)
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
        "Dog could not be found for this customer."
      );
      setLoading(false);
      return;
    }

    setForm({
      name: data.name || "",
      breed: data.breed || "",
      date_of_birth: data.date_of_birth || "",
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
      medical_notes: data.medical_notes || "",
      medication_notes:
        data.medication_notes || "",
      feeding_notes: data.feeding_notes || "",
      behaviour_notes:
        data.behaviour_notes || "",
    });

    setDogActive(Boolean(data.active));

    setMeetAndGreetCompleted(
      Boolean(data.meet_and_greet_completed)
    );

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

    setSaving(true);
    setMessage("");
    setIsError(false);

    const validationMessage =
      validateDogDetails(form);

    if (validationMessage) {
      setSaving(false);
      setIsError(true);
      setMessage(validationMessage);
      return;
    }

    const { error } = await supabase
      .from("dogs")
      .update({
        name: formatName(form.name),
        breed: formatName(form.breed),
        date_of_birth:
          form.date_of_birth || null,
        weight_kg: form.weight_kg
          ? Number(form.weight_kg)
          : null,
        gender: form.gender || null,
        neutered: form.neutered === "yes",
        vaccinated:
          form.vaccinated === "yes",
        vaccination_expiry:
          form.vaccinated === "yes"
            ? form.vaccination_expiry || null
            : null,
        microchip_number:
          form.microchip_number.trim(),
        medical_notes:
          form.medical_notes.trim(),
        medication_notes:
          form.medication_notes.trim(),
        feeding_notes:
          form.feeding_notes.trim(),
        behaviour_notes:
          form.behaviour_notes.trim(),
        meet_and_greet_completed:
          meetAndGreetCompleted,
        active: dogActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dogId)
      .eq("owner_id", customerId);

    setSaving(false);

    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }

    window.location.href =
      `/admin/customers/${customerId}`;
  }

  function toggleDogActiveStatus() {
    const newActiveStatus = !dogActive;

    const confirmed = window.confirm(
      newActiveStatus
        ? `Reactivate ${formatName(
            form.name || "this dog"
          )}?`
        : `Deactivate ${formatName(
            form.name || "this dog"
          )}?\n\nThe dog will no longer be available for new bookings.`
    );

    if (!confirmed) {
      return;
    }

    setDogActive(newActiveStatus);
  }

  if (loading) {
    return (
      <LoadingScreen message="Loading dog details..." />
    );
  }

  return (
    <AdminPageLayout>
      <PageCard
        title={`Edit ${formatName(form.name) || "Dog"}`}
        subtitle="Update the dog's details, care requirements and administrative status."
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
          submitLabel="Save Dog"
          savingLabel="Saving Dog..."
          cancelHref={`/admin/customers/${customerId}`}
          meetAndGreetCompleted={
            meetAndGreetCompleted
          }
          allowMeetAndGreetManagement={true}
          onMeetAndGreetChange={
            setMeetAndGreetCompleted
          }
          additionalActions={
            dogActive ? (
              <button
                type="button"
                onClick={toggleDogActiveStatus}
                disabled={saving}
                className="inline-flex min-h-11 w-fit items-center justify-center rounded-lg border border-red-400 px-4 py-2 text-sm font-semibold text-red-600 transition-all duration-300 hover:scale-105 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 md:text-base"
              >
                Deactivate Dog
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleDogActiveStatus}
                disabled={saving}
                className="inline-flex min-h-11 w-fit items-center justify-center rounded-lg border border-green-500 px-4 py-2 text-sm font-semibold text-green-700 transition-all duration-300 hover:scale-105 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 md:text-base"
              >
                Reactivate Dog
              </button>
            )
          }
        />
      </PageCard>
    </AdminPageLayout>
  );
}