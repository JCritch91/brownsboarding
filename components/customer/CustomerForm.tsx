"use client";

import { type FormEvent } from "react";

import Button from "@/components/Buttons";
import MessageBox from "@/components/MessageBox";
import { FormInput } from "@/components/FormInput";

export type CustomerFormValues = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_line_1: string;
  address_line_2: string;
  town: string;
  postcode: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
};

type CustomerFormProps = {
  form: CustomerFormValues;
  onChange: (field: keyof CustomerFormValues, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  message?: string;
  isError?: boolean;
  submitLabel?: string;
  savingLabel?: string;
  cancelHref: string;
  emailDisabled?: boolean;
  additionalActions?: React.ReactNode;
};

export default function CustomerForm({
  form,
  onChange,
  onSubmit,
  saving,
  message = "",
  isError = false,
  submitLabel = "Save Details",
  savingLabel = "Saving...",
  cancelHref,
  emailDisabled = true,
  additionalActions,
}: CustomerFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6 md:space-y-10">
      {/* Personal Details */}
      <section>
        <h2 className="mb-4 text-xl font-semibold text-[#5C4033] md:mb-6 md:text-2xl">
          Personal Details
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
          <FormInput
            id="firstName"
            label="First Name"
            type="text"
            value={form.first_name}
            onChange={(event) => onChange("first_name", event.target.value)}
            required
          />

          <FormInput
            id="lastName"
            label="Last Name"
            type="text"
            value={form.last_name}
            onChange={(event) => onChange("last_name", event.target.value)}
            required
          />

          <FormInput
            id="email"
            label="Email Address"
            type="email"
            value={form.email}
            onChange={(event) => onChange("email", event.target.value)}
            disabled={emailDisabled}
            required
            className={emailDisabled ? "cursor-not-allowed bg-[#F5EFE6]" : ""}
          />

          <FormInput
            id="phone"
            label="Phone Number"
            type="tel"
            value={form.phone}
            onChange={(event) => onChange("phone", event.target.value)}
            placeholder="07123 456789"
          />
        </div>
      </section>

      {/* Address */}
      <section>
        <h2 className="mb-4 text-xl font-semibold text-[#5C4033] md:mb-6 md:text-2xl">
          Address
        </h2>

        <div className="space-y-3 md:space-y-4">
          <FormInput
            id="addressLine1"
            label="Address Line 1"
            type="text"
            value={form.address_line_1}
            onChange={(event) => onChange("address_line_1", event.target.value)}
          />

          <FormInput
            id="addressLine2"
            label="Address Line 2"
            type="text"
            value={form.address_line_2}
            onChange={(event) => onChange("address_line_2", event.target.value)}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
            <FormInput
              id="town"
              label="Town / City"
              type="text"
              value={form.town}
              onChange={(event) => onChange("town", event.target.value)}
            />

            <FormInput
              id="postcode"
              label="Postcode"
              type="text"
              value={form.postcode}
              onChange={(event) => onChange("postcode", event.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Emergency Contact */}
      <section>
        <h2 className="mb-4 text-xl font-semibold text-[#5C4033] md:mb-6 md:text-2xl">
          Emergency Contact
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
          <FormInput
            id="emergencyContactName"
            label="Emergency Contact Name"
            type="text"
            value={form.emergency_contact_name}
            onChange={(event) =>
              onChange("emergency_contact_name", event.target.value)
            }
          />

          <FormInput
            id="emergencyContactPhone"
            label="Emergency Contact Phone"
            type="tel"
            value={form.emergency_contact_phone}
            onChange={(event) =>
              onChange("emergency_contact_phone", event.target.value)
            }
            placeholder="07123 456789"
          />
        </div>
      </section>

      {/* Veterinary Details */}

      {message && (
        <MessageBox type={isError ? "error" : "success"}>{message}</MessageBox>
      )}

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
