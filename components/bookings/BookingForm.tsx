"use client";

import type {
  FormEvent,
  ReactNode,
} from "react";

import {
  DayPicker,
  type DateRange,
} from "react-day-picker";

import {
  formatDisplayDate,
  formatMoney,
} from "@/lib/helpers";

import Button from "@/components/Buttons";
import MessageBox from "@/components/MessageBox";
import {
  FormSelect,
  FormTextarea,
} from "@/components/FormInput";

export type BookingFormDog = {
  id: string;
  name: string;
  breed: string | null;
  meet_and_greet_completed: boolean | null;
  vaccinated: boolean | null;
  vaccination_expiry: string | null;
};

export type BookingFormAvailability = {
  id: string;
  date: string;
  available: boolean;
  total_spaces: number;
  spaces_available: number;
  notes: string | null;
};

type BookingFormProps = {
  dogs: BookingFormDog[];
  availability: BookingFormAvailability[];

  selectedDog: string;
  selectedRange: DateRange | undefined;

  startDate: string;
  endDate: string;
  notes: string;

  calendarMonths: number;

  projectedNights: number;
  nightlyRate: number | null;
  projectedTotal: number;
  projectedDeposit: number;
  projectedBalance: number;
  isProjectedShortNotice: boolean;

  saving: boolean;
  message?: string;
  isError?: boolean;

  submitLabel?: string;
  savingLabel?: string;
  cancelHref?: string;

  introductoryMessage?: string;
  summaryMessage?: string;

  additionalActions?: ReactNode;
  additionalFields?: ReactNode;

  onDogChange: (dogId: string) => void;
  onDateRangeSelect: (
    range: DateRange | undefined
  ) => void;
  onClearDates: () => void;
  onNotesChange: (notes: string) => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>
  ) => void;

  isPastDate: (date: Date) => boolean;
  isUnavailableDate: (date: Date) => boolean;
  isLimitedAvailabilityDate: (
    date: Date
  ) => boolean;
  isGoodAvailabilityDate: (
    date: Date
  ) => boolean;
};

export default function BookingForm({
  dogs,
  selectedDog,
  selectedRange,
  startDate,
  endDate,
  notes,
  calendarMonths,
  projectedNights,
  nightlyRate,
  projectedTotal,
  projectedDeposit,
  projectedBalance,
  isProjectedShortNotice,
  saving,
  message = "",
  isError = false,
  submitLabel = "Request Booking",
  savingLabel = "Submitting Request...",
  cancelHref,
  introductoryMessage =
    "If you are booking multiple dogs for the same stay, please submit a separate booking request for each dog.",
  summaryMessage =
    "Your booking request will be reviewed by Browns Boarding before confirmation. Any projected cost shown is an estimate. The final cost and deposit amount will be confirmed before your booking is accepted.",
  additionalActions,
  additionalFields,
  onDogChange,
  onDateRangeSelect,
  onClearDates,
  onNotesChange,
  onSubmit,
  isPastDate,
  isUnavailableDate,
  isLimitedAvailabilityDate,
  isGoodAvailabilityDate,
}: BookingFormProps) {
  return (
    <div>
      {introductoryMessage && (
        <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-3 md:mb-8 md:p-4">
          <p className="text-sm text-amber-800 md:text-base">
            {introductoryMessage}
          </p>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="space-y-6 md:space-y-10"
      >
        {/* Dog selection */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-[#5C4033] md:mb-6 md:text-2xl">
            Select Dog
          </h2>

          <FormSelect
            id="dog"
            label="Dog"
            value={selectedDog}
            onChange={(event) =>
              onDogChange(event.target.value)
            }
            required
          >
            <option value="">Select a dog</option>

            {dogs.map((dog) => (
              <option
                key={dog.id}
                value={dog.id}
              >
                {dog.name}
                {dog.breed
                  ? ` • ${dog.breed}`
                  : ""}
              </option>
            ))}
          </FormSelect>
        </section>

        {/* Admin-specific fields */}
        {additionalFields}

        {/* Availability calendar */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-[#5C4033] md:mb-6 md:text-2xl">
            Stay Dates
          </h2>

          <div className="overflow-x-auto rounded-xl border border-[#D9CBB8] bg-white p-3 shadow-sm md:p-6">
            <DayPicker
              mode="range"
              selected={selectedRange}
              onSelect={onDateRangeSelect}
              disabled={isPastDate}
              numberOfMonths={calendarMonths}
              fixedWeeks
              modifiers={{
                available: isGoodAvailabilityDate,
                limited:
                  isLimitedAvailabilityDate,
                unavailable: isUnavailableDate,
              }}
              modifiersClassNames={{
                available:
                  "bg-green-100 text-green-800 border border-green-300 hover:bg-green-200",
                limited:
                  "bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200",
                unavailable:
                  "bg-red-50 text-red-300 line-through cursor-not-allowed",
                selected:
                  "bg-[#8B6A4E] text-white border border-[#8B6A4E]",
                range_start:
                  "bg-[#8B6A4E] text-white border border-[#8B6A4E]",
                range_end:
                  "bg-[#8B6A4E] text-white border border-[#8B6A4E]",
                range_middle:
                  "bg-[#E8DDCF] text-[#5C4033] border border-[#D9CBB8]",
              }}
              classNames={{
                months:
                  "flex flex-col md:flex-row justify-center gap-4 md:gap-6",
                month:
                  "w-full max-w-xs md:max-w-lg",
                month_caption:
                  "flex justify-center items-center mb-3 md:mb-4",
                caption_label:
                  "text-lg md:text-xl font-bold text-[#5C4033]",
                nav:
                  "flex items-center justify-between mb-4",
                button_previous:
                  "text-[#5C4033] hover:text-[#8B6A4E] hover:scale-110 transition-all duration-200",
                button_next:
                  "text-[#5C4033] hover:text-[#8B6A4E] hover:scale-110 transition-all duration-200",
                weekdays:
                  "grid grid-cols-7 mb-2",
                weekday:
                  "text-center text-xs md:text-sm font-semibold text-[#8B6A4E]",
                week:
                  "grid grid-cols-7 gap-2 md:gap-3 mb-1 md:mb-2",
                day:
                  "h-8 w-8 md:h-9 md:w-9 flex items-center justify-center rounded-full text-xs md:text-sm font-medium transition-all duration-200",
                today:
                  "ring-2 ring-[#8B6A4E] ring-offset-2",
              }}
              className="mx-auto"
            />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] md:mt-4 md:gap-3 md:text-sm">
            <div className="rounded-lg border border-green-300 bg-green-50 px-2 py-2 text-center font-medium text-green-800 md:p-3">
              Available
            </div>

            <div className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-2 text-center font-medium text-amber-800 md:p-3">
              Limited spaces
            </div>

            <div className="rounded-lg border border-red-300 bg-red-50 px-2 py-2 text-center font-medium text-red-700 md:p-3">
              Unavailable / full
            </div>
          </div>

          {(startDate || endDate) && (
            <div className="mt-3 rounded-lg border border-[#D9CBB8] bg-[#F5EFE6] p-3 md:mt-4 md:p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[#5C4033] md:text-base">
                    Selected dates
                  </p>

                  <p className="mt-1 text-sm text-[#8B6A4E] md:text-base">
                    Arrival:{" "}
                    {startDate
                      ? formatDisplayDate(startDate)
                      : "Not selected"}
                  </p>

                  <p className="text-sm text-[#8B6A4E] md:text-base">
                    Departure:{" "}
                    {endDate
                      ? formatDisplayDate(endDate)
                      : "Not selected"}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="light"
                  onClick={onClearDates}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          )}

          {projectedTotal > 0 && (
            <div className="mt-3 rounded-lg border border-[#D9CBB8] bg-[#F5EFE6] p-3 md:mt-4 md:p-4">
              <p className="text-sm font-semibold text-[#5C4033] md:text-base">
                Projected Stay Cost
              </p>

              <p className="mt-2 text-sm text-[#8B6A4E] md:text-base">
                {projectedNights} night
                {projectedNights === 1 ? "" : "s"}{" "}
                at {formatMoney(nightlyRate)} per
                night.
              </p>

              <p className="mt-1 text-sm text-[#8B6A4E] md:text-base">
                Estimated total cost:{" "}
                {formatMoney(projectedTotal)}
              </p>

              {isProjectedShortNotice ? (
                <p className="mt-3 text-xs font-medium text-amber-700 md:text-sm">
                  This booking starts within 14
                  days, so no deposit will be
                  requested. The full balance will
                  be due if Browns Boarding accepts
                  the booking.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-[#8B6A4E] md:text-base">
                    Estimated deposit:{" "}
                    {formatMoney(projectedDeposit)}
                  </p>

                  <p className="mt-1 text-sm text-[#8B6A4E] md:text-base">
                    Estimated remaining balance:{" "}
                    {formatMoney(projectedBalance)}
                  </p>
                </>
              )}

              <p className="mt-3 text-xs italic text-[#8B6A4E] md:text-sm">
                This is an estimate only. Browns
                Boarding will confirm the final
                price before accepting your
                booking.
              </p>
            </div>
          )}
        </section>

        {/* Notes */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-[#5C4033] md:mb-6 md:text-2xl">
            Additional Notes
          </h2>

          <FormTextarea
            id="notes"
            label="Anything we should know about this booking?"
            value={notes}
            onChange={(event) =>
              onNotesChange(event.target.value)
            }
            rows={2}
          />
        </section>

        {/* Summary message */}
        {summaryMessage && (
          <section>
            <MessageBox type="info">
              {summaryMessage}
            </MessageBox>
          </section>
        )}

        {/* Result message */}
        {message && (
          <MessageBox
            type={isError ? "error" : "success"}
          >
            {message}
          </MessageBox>
        )}

        {/* Actions */}
        <div className="flex flex-wrap justify-center gap-3 md:gap-4">
          <Button
            variant="dark"
            type="submit"
            disabled={saving}
            className="disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
          >
            {saving
              ? savingLabel
              : submitLabel}
          </Button>

          {cancelHref && (
            <Button variant="light" href={cancelHref}>
              Cancel
            </Button>
          )}

          {additionalActions}
        </div>
      </form>
    </div>
  );
}