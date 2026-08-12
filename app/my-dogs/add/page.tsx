"use client";

import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/appActions";

import CustomerPageLayout from "@/components/CustomerPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import MessageBox from "@/components/MessageBox";
import { formatName, validateDogDetails } from "@/lib/helpers";
import {
  FormInput,
  FormSelect,
  FormTextarea,
} from "@/components/FormInput";

export default function AddDogPage() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
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

  function updateField(field: keyof typeof form, value: string) {
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

    const { error } = await supabase.from("dogs").insert({
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
    active: true,
    meet_and_greet_completed: false,
    updated_at: new Date().toISOString(),
    });

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
        title="Add Dog"
        subtitle="Create a profile for your dog before requesting a booking."
        actions={
          <Button href="/my-dogs">
            Back to My Dogs
          </Button>
        }
      >

        <form onSubmit={handleSave} className="space-y-6 md:space-y-8">
          {/* Dog Details */}
          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-[#5C4033] mb-4 md:mb-6">
              Dog Details
            </h2>

            <div className="bg-blue-50 border border-blue-200 p-3 md:p-4 rounded-lg mb-4 md:mb-6">
              <p className="text-sm md:text-base text-blue-800">
                Complete the Dog Details section to create your dog profile.
                Care, Health & Behaviour information can be added now or
                updated later.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <FormInput
                id="name"
                label="Dog Name *"
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />

              <FormInput
                id="breed"
                label="Breed *"
                type="text"
                value={form.breed}
                onChange={(e) => updateField("breed", e.target.value)}
                required
              />

              <FormInput
                id="dateOfBirth"
                label="Date of Birth"
                type="date"
                value={form.date_of_birth}
                onChange={(e) =>
                  updateField("date_of_birth", e.target.value)
                }
              />

              <FormInput
                id="weightKg"
                label="Weight (kg)"
                type="number"
                step="0.1"
                value={form.weight_kg}
                onChange={(e) => updateField("weight_kg", e.target.value)}
              />

              <FormSelect
                id="gender"
                label="Gender"
                value={form.gender}
                onChange={(e) => updateField("gender", e.target.value)}
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </FormSelect>

              <FormInput
                id="microchipNumber"
                label="Microchip Number"
                type="text"
                value={form.microchip_number}
                onChange={(e) =>
                  updateField("microchip_number", e.target.value)
                }
              />

              <FormSelect
                id="neutered"
                label="Neutered?"
                value={form.neutered}
                onChange={(e) => updateField("neutered", e.target.value)}
              >
                <option value="">Select an Option</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </FormSelect>

              <FormSelect
                id="vaccinated"
                label="Vaccinated?"
                value={form.vaccinated}
                onChange={(e) => {
                  updateField("vaccinated", e.target.value);

                  if (e.target.value !== "yes") {
                    updateField("vaccination_expiry", "");
                  }
                }}
              >
                <option value="">Select an Option</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </FormSelect>

              {form.vaccinated === "yes" && (
                <div className="col-span-2">
                  <FormInput
                    id="vaccinationExpiry"
                    label="Vaccination Expiry Date *"
                    type="date"
                    value={form.vaccination_expiry}
                    onChange={(e) =>
                      updateField("vaccination_expiry", e.target.value)
                    }
                    required
                  />
                </div>
              )}
            </div>
          </section>

          {/* Care, Health and Behaviour */}
          <section className="mt-8 md:mt-12">
            <h2 className="text-xl md:text-2xl font-semibold text-[#5C4033] mb-4 md:mb-6">
              Care, Health & Behaviour
            </h2>

            <p className="text-sm md:text-base text-[#8B6A4E] mb-4 md:mb-6">
              This section can be completed later but should be kept up to date
              before boarding.
            </p>

            <div className="space-y-3 md:space-y-4">
              <FormTextarea
                id="medicalNotes"
                label="Medical Notes"
                value={form.medical_notes}
                onChange={(e) =>
                  updateField("medical_notes", e.target.value)
                }
                rows={2}
              />

              <FormTextarea
                id="medicationNotes"
                label="Medication Notes"
                value={form.medication_notes}
                onChange={(e) =>
                  updateField("medication_notes", e.target.value)
                }
                rows={2}
              />

              <FormTextarea
                id="feedingNotes"
                label="Feeding Notes"
                value={form.feeding_notes}
                onChange={(e) =>
                  updateField("feeding_notes", e.target.value)
                }
                rows={2}
              />

              <FormTextarea
                id="behaviourNotes"
                label="Behaviour Notes"
                value={form.behaviour_notes}
                onChange={(e) =>
                  updateField("behaviour_notes", e.target.value)
                }
                rows={2}
              />
            </div>
          </section>

          {/* Meet and Greet */}
          <section className="mt-8 md:mt-12">
            <h2 className="text-xl md:text-2xl font-semibold text-[#5C4033] mb-3 md:mb-4">
              Meet & Greet Status
            </h2>

            <div className="bg-amber-50 border border-amber-300 p-3 md:p-4 rounded-lg">
              <p className="text-sm md:text-base text-amber-800 font-medium">
                Meet & Greet Required
              </p>

              <p className="text-sm md:text-base text-amber-700 mt-1 md:mt-2">
                This will be updated by Browns Boarding after a successful meet
                and greet.
              </p>
            </div>
          </section>

          {message && (
            <MessageBox type="error">
              {message}
            </MessageBox>
          )}

          {/* Buttons */}
          <div className="mt-6 md:mt-10 flex flex-wrap justify-center gap-3 md:gap-4">
            <Button
              variant="dark"
              type="submit"
              disabled={saving}
              className="disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {saving ? "Saving Dog..." : "Save Dog"}
            </Button>

            <Button variant="light" href="/my-dogs">
              Cancel
            </Button>
          </div>
        </form>
      </PageCard>
    </CustomerPageLayout>
  );
}