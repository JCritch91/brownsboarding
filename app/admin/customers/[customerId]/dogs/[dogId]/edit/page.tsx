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
import ConfirmationModal from "@/components/modals/ConfirmationModal";

type UpdateAdminDogResponse = {
  success: boolean;
  dogUpdated: boolean;
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

  const [form, setForm] = useState<DogFormValues>(emptyForm);

  const [dogActive, setDogActive] = useState(true);

  const [meetAndGreetCompleted, setMeetAndGreetCompleted] = useState(false);
  const [showActiveStatusModal, setShowActiveStatusModal] = useState(false);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    checkAdminAndLoadDog();
  }, [customerId, dogId]);

  async function checkAdminAndLoadDog() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    const { redirectTo } = await ensureActiveAdminUser();

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
        `,
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
      setMessage("Dog could not be found for this customer.");
      setLoading(false);
      return;
    }

    setForm({
      name: data.name || "",
      breed: data.breed || "",
      date_of_birth: data.date_of_birth || "",
      weight_kg: data.weight_kg !== null ? String(data.weight_kg) : "",
      gender: data.gender || "",
      neutered: data.neutered === null ? "" : data.neutered ? "yes" : "no",
      vaccinated:
        data.vaccinated === null ? "" : data.vaccinated ? "yes" : "no",
      vaccination_expiry: data.vaccination_expiry || "",
      microchip_number: data.microchip_number || "",
      medical_notes: data.medical_notes || "",
      medication_notes: data.medication_notes || "",
      feeding_notes: data.feeding_notes || "",
      behaviour_notes: data.behaviour_notes || "",
    });

    setDogActive(Boolean(data.active));

    setMeetAndGreetCompleted(Boolean(data.meet_and_greet_completed));

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

    const result = await authenticatedApiRequest<UpdateAdminDogResponse>(
      `/api/admin/customers/${customerId}/dogs/${dogId}`,
      {
        method: "PATCH",
        body: {
          ...form,
          meetAndGreetCompleted,
          active: dogActive,
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
      setMessage(result.error || "The dog's details could not be updated.");
      return;
    }

    if (!result.data || !result.data.dogUpdated) {
      setIsError(true);
      setMessage(
        result.data?.error || "The dog service did not update the dog.",
      );
      return;
    }

    setIsError(false);

    window.location.href = `/admin/customers/${customerId}`;
  }

  function requestDogActiveStatusChange() {
    if (saving) {
      return;
    }

    setMessage("");
    setIsError(false);
    setShowActiveStatusModal(true);
  }

  function confirmDogActiveStatusChange() {
    if (saving) {
      return;
    }

    setDogActive((current) => !current);
    setShowActiveStatusModal(false);
  }

  if (loading) {
    return <LoadingScreen message="Loading dog details..." />;
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
          meetAndGreetCompleted={meetAndGreetCompleted}
          allowMeetAndGreetManagement={true}
          onMeetAndGreetChange={setMeetAndGreetCompleted}
          additionalActions={
            dogActive ? (
              <button
                type="button"
                onClick={requestDogActiveStatusChange}
                disabled={saving}
                className="inline-flex min-h-11 w-fit items-center justify-center rounded-lg border border-red-400 px-4 py-2 text-sm font-semibold text-red-600 transition-all duration-300 hover:scale-105 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 md:text-base"
              >
                Deactivate Dog
              </button>
            ) : (
              <button
                type="button"
                onClick={requestDogActiveStatusChange}
                disabled={saving}
                className="inline-flex min-h-11 w-fit items-center justify-center rounded-lg border border-green-500 px-4 py-2 text-sm font-semibold text-green-700 transition-all duration-300 hover:scale-105 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 md:text-base"
              >
                Reactivate Dog
              </button>
            )
          }
        />
      </PageCard>

      <ConfirmationModal
        isOpen={showActiveStatusModal}
        title={dogActive ? "Deactivate Dog" : "Reactivate Dog"}
        confirmText={dogActive ? "Deactivate Dog" : "Reactivate Dog"}
        cancelText="Go Back"
        isConfirming={saving}
        variant={dogActive ? "danger" : "primary"}
        onConfirm={confirmDogActiveStatusChange}
        onCancel={() => {
          if (!saving) {
            setShowActiveStatusModal(false);
          }
        }}
      >
        <div className="space-y-4">
          <dl className="rounded-xl border border-[#D9CBB8] bg-[#FFFDF9] p-4">
            <div>
              <dt className="text-xs font-semibold text-[#8B6A4E]">Dog</dt>
              <dd className="mt-1 text-lg font-semibold text-[#5C4033]">
                {formatName(form.name || "Dog")}
              </dd>
            </div>

            {form.breed && (
              <div className="mt-3">
                <dt className="text-xs font-semibold text-[#8B6A4E]">Breed</dt>
                <dd className="mt-1 text-[#5C4033]">
                  {formatName(form.breed)}
                </dd>
              </div>
            )}
          </dl>

          {dogActive ? (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-800">
              <p className="font-semibold">This dog will become inactive.</p>

              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>The dog will not be available for new bookings.</li>
                <li>Existing and historic booking records will be retained.</li>
                <li>You must save the form to apply this change.</li>
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-green-800">
              <p className="font-semibold">This dog will become active.</p>

              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>The dog will become available for new bookings.</li>
                <li>
                  Normal vaccination and availability checks will still apply.
                </li>
                <li>You must save the form to apply this change.</li>
              </ul>
            </div>
          )}
        </div>
      </ConfirmationModal>
    </AdminPageLayout>
  );
}
