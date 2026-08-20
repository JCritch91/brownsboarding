"use client";

import { type FormEvent, type ReactNode } from "react";

import Button from "@/components/Buttons";
import MessageBox from "@/components/MessageBox";
import { FormInput, FormSelect, FormTextarea } from "@/components/FormInput";

export type DogFormValues = {
  name: string;
  breed: string;
  date_of_birth: string;
  weight_kg: string;
  gender: string;
  neutered: string;
  vaccinated: string;
  vaccination_expiry: string;
  microchip_number: string;
  medical_notes: string;
  medication_notes: string;
  feeding_notes: string;
  behaviour_notes: string;
};

type DogFormProps = {
  form: DogFormValues;
  onChange: (field: keyof DogFormValues, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  message?: string;
  isError?: boolean;
  submitLabel?: string;
  savingLabel?: string;
  cancelHref: string;
  meetAndGreetCompleted?: boolean;
  allowMeetAndGreetManagement?: boolean;
  onMeetAndGreetChange?: (completed: boolean) => void;
  additionalActions?: ReactNode;
};

export default function DogForm({
  form,
  onChange,
  onSubmit,
  saving,
  message = "",
  isError = false,
  submitLabel = "Save Dog",
  savingLabel = "Saving...",
  cancelHref,
  meetAndGreetCompleted = false,
  allowMeetAndGreetManagement = false,
  onMeetAndGreetChange,
  additionalActions,
}: DogFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6 md:space-y-10">
      {/* Dog Details */}
      <section>
        <h2 className="mb-4 text-xl font-semibold text-[#5C4033] md:mb-6 md:text-2xl">
          Dog Details
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
          <FormInput
            id="name"
            label="Dog Name *"
            type="text"
            value={form.name}
            onChange={(event) => onChange("name", event.target.value)}
            required
          />

          <FormInput
            id="breed"
            label="Breed *"
            type="text"
            value={form.breed}
            onChange={(event) => onChange("breed", event.target.value)}
            required
          />

          <FormInput
            id="dateOfBirth"
            label="Date of Birth"
            type="date"
            value={form.date_of_birth}
            onChange={(event) => onChange("date_of_birth", event.target.value)}
          />

          <FormInput
            id="weightKg"
            label="Weight (kg)"
            type="number"
            min="0"
            step="0.1"
            value={form.weight_kg}
            onChange={(event) => onChange("weight_kg", event.target.value)}
          />

          <FormSelect
            id="gender"
            label="Gender"
            value={form.gender}
            onChange={(event) => onChange("gender", event.target.value)}
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
            onChange={(event) =>
              onChange("microchip_number", event.target.value)
            }
          />

          <FormSelect
            id="neutered"
            label="Neutered?"
            value={form.neutered}
            onChange={(event) => onChange("neutered", event.target.value)}
          >
            <option value="">Select an Option</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </FormSelect>

          <FormSelect
            id="vaccinated"
            label="Vaccinated?"
            value={form.vaccinated}
            onChange={(event) => {
              const vaccinatedValue = event.target.value;

              onChange("vaccinated", vaccinatedValue);

              if (vaccinatedValue !== "yes") {
                onChange("vaccination_expiry", "");
              }
            }}
          >
            <option value="">Select an Option</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </FormSelect>

          {form.vaccinated === "yes" && (
            <div className="sm:col-span-2">
              <FormInput
                id="vaccinationExpiry"
                label="Vaccination Expiry Date *"
                type="date"
                value={form.vaccination_expiry}
                onChange={(event) =>
                  onChange("vaccination_expiry", event.target.value)
                }
                required
              />
            </div>
          )}
        </div>
      </section>

      {/* Care, Health and Behaviour */}
      <section>
        <h2 className="mb-4 text-xl font-semibold text-[#5C4033] md:mb-6 md:text-2xl">
          Care, Health & Behaviour
        </h2>

        <p className="mb-4 text-sm text-[#8B6A4E] md:mb-6 md:text-base">
          Keep this information up to date before every boarding stay.
        </p>

        <div className="space-y-3 md:space-y-4">
          <FormTextarea
            id="medicalNotes"
            label="Medical Notes"
            value={form.medical_notes}
            onChange={(event) => onChange("medical_notes", event.target.value)}
            rows={2}
          />

          <FormTextarea
            id="medicationNotes"
            label="Medication Notes"
            value={form.medication_notes}
            onChange={(event) =>
              onChange("medication_notes", event.target.value)
            }
            rows={2}
          />

          <FormTextarea
            id="feedingNotes"
            label="Feeding Notes"
            value={form.feeding_notes}
            onChange={(event) => onChange("feeding_notes", event.target.value)}
            rows={2}
          />

          <FormTextarea
            id="behaviourNotes"
            label="Behaviour Notes"
            value={form.behaviour_notes}
            onChange={(event) =>
              onChange("behaviour_notes", event.target.value)
            }
            rows={2}
          />
        </div>
      </section>

      {/* Meet and Greet */}
      <section>
        <h2 className="mb-3 text-xl font-semibold text-[#5C4033] md:mb-4 md:text-2xl">
          Meet & Greet Status
        </h2>

        <div
          className={`rounded-lg border p-3 md:p-4 ${
            meetAndGreetCompleted
              ? "border-green-300 bg-green-50"
              : "border-amber-300 bg-amber-50"
          }`}
        >
          <p
            className={`text-sm font-medium md:text-base ${
              meetAndGreetCompleted ? "text-green-800" : "text-amber-800"
            }`}
          >
            {meetAndGreetCompleted
              ? "Meet & Greet Completed"
              : "Meet & Greet Required"}
          </p>

          <p
            className={`mt-1 text-sm md:mt-2 md:text-base ${
              meetAndGreetCompleted ? "text-green-700" : "text-amber-700"
            }`}
          >
            {meetAndGreetCompleted
              ? "This dog has completed the required Meet & Greet."
              : "This status will be updated by Browns Boarding after a successful Meet & Greet."}
          </p>

          {allowMeetAndGreetManagement && onMeetAndGreetChange && (
            <div className="mt-4">
              <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-[#D9CBB8] bg-white px-3 py-3 text-sm font-medium text-[#5C4033] md:text-base">
                Meet & Greet Completed
                <input
                  type="checkbox"
                  checked={meetAndGreetCompleted}
                  onChange={(event) =>
                    onMeetAndGreetChange(event.target.checked)
                  }
                  className="h-5 w-5 accent-[#8B6A4E]"
                />
              </label>
            </div>
          )}
        </div>
      </section>

      {message && (
        <MessageBox type={isError ? "error" : "success"}>{message}</MessageBox>
      )}

      {/* Actions */}
      <div className="flex flex-wrap justify-center gap-3 md:gap-4">
        <Button
          variant="dark"
          type="submit"
          disabled={saving}
          className="disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
        >
          {saving ? savingLabel : submitLabel}
        </Button>

        <Button variant="light" href={cancelHref}>
          Cancel
        </Button>

        {additionalActions}
      </div>
    </form>
  );
}
