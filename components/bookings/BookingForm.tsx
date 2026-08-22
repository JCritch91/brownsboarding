"use client";

import type { FormEvent, ReactNode } from "react";

import { DayPicker, type DateRange } from "react-day-picker";

import { formatDisplayDate, formatMoney } from "@/lib/helpers";

import Button from "@/components/Buttons";
import MessageBox from "@/components/MessageBox";
import { FormSelect, FormTextarea } from "@/components/FormInput";
import type { Availability } from "@/types/availability";

import type { BookingType, DaycareSessionType } from "@/types/booking";

export type BookingFormDog = {
  id: string;
  name: string;
  breed: string | null;
  meet_and_greet_completed: boolean | null;
  vaccinated: boolean | null;
  vaccination_expiry: string | null;
  can_share_with_other_dogs: boolean;
};

export type BookingFormAvailability = Availability;

type BookingFormProps = {
  dogs: BookingFormDog[];
  availability: BookingFormAvailability[];

  selectedDogIds: string[];
  bookingType: BookingType;
  daycareSession: DaycareSessionType | null;
  selectedRange: DateRange | undefined;
  startDate: string;
  endDate: string;
  notes: string;
  calendarMonths: number;

  projectedQuantity: number;
  projectedUnitLabel: string;
  projectedUnitRate: number | null;
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

  onDogSelectionChange: (dogIds: string[]) => void;
  onBookingTypeChange: (bookingType: BookingType) => void;
  onDaycareSessionChange: (daycareSession: DaycareSessionType) => void;
  onDateRangeSelect: (range: DateRange | undefined) => void;
  onClearDates: () => void;
  onNotesChange: (notes: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;

  isPastDate: (date: Date) => boolean;
  isUnavailableDate: (date: Date) => boolean;
  isLimitedAvailabilityDate: (date: Date) => boolean;
  isGoodAvailabilityDate: (date: Date) => boolean;
};

export default function BookingForm({
  dogs,
  selectedDogIds,
  bookingType,
  daycareSession,
  selectedRange,
  startDate,
  endDate,
  notes,
  calendarMonths,
  projectedQuantity,
  projectedUnitLabel,
  projectedUnitRate,
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
  introductoryMessage = "If you are booking multiple dogs for the same stay, please submit a separate booking request for each dog.",
  summaryMessage = "Your booking request will be reviewed by Browns Boarding before confirmation. Any projected cost shown is an estimate. The final cost and deposit amount will be confirmed before your booking is accepted.",
  additionalActions,
  additionalFields,
  onDogSelectionChange,
  onBookingTypeChange,
  onDaycareSessionChange,
  onDateRangeSelect,
  onClearDates,
  onNotesChange,
  onSubmit,
  isPastDate,
  isUnavailableDate,
  isLimitedAvailabilityDate,
  isGoodAvailabilityDate,
}: BookingFormProps) {
  function toggleDogSelection(dogId: string) {
    if (selectedDogIds.includes(dogId)) {
      onDogSelectionChange(
        selectedDogIds.filter((selectedDogId) => selectedDogId !== dogId),
      );

      return;
    }

    if (selectedDogIds.length >= 2) {
      return;
    }

    onDogSelectionChange([...selectedDogIds, dogId]);
  }
  return (
    <div>
      {introductoryMessage && (
        <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-3 md:mb-8 md:p-4">
          <p className="text-sm text-amber-800 md:text-base">
            {introductoryMessage}
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6 md:space-y-10">
        {/* Dog selection */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-[#5C4033] md:mb-6 md:text-2xl">
            Select Dog
          </h2>

          <p className="mb-4 text-sm text-[#8B6A4E] md:text-base">
            Select one or two dogs from the same household for this booking.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            {dogs.map((dog) => {
              const selected = selectedDogIds.includes(dog.id);

              const selectionLimitReached =
                selectedDogIds.length >= 2 && !selected;

              return (
                <label
                  key={dog.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                    selected
                      ? "border-[#8B6A4E] bg-[#F5EFE6]"
                      : "border-[#D9CBB8] bg-white hover:bg-[#FFFDF9]"
                  } ${
                    selectionLimitReached ? "cursor-not-allowed opacity-60" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={selectionLimitReached}
                    onChange={() => toggleDogSelection(dog.id)}
                    className="mt-1 h-5 w-5 accent-[#8B6A4E]"
                  />

                  <span>
                    <span className="block font-semibold text-[#5C4033]">
                      {dog.name}
                    </span>

                    {dog.breed && (
                      <span className="mt-1 block text-sm text-[#8B6A4E]">
                        {dog.breed}
                      </span>
                    )}

                    {!dog.can_share_with_other_dogs && (
                      <span className="mt-2 block text-xs font-medium text-amber-700">
                        Must not share with dogs from another household
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>

          <p className="mt-3 text-sm text-[#8B6A4E]">
            {selectedDogIds.length} of 2 dogs selected
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-[#5C4033] md:mb-6 md:text-2xl">
            Select Service
          </h2>

          <div className="grid gap-3 md:grid-cols-2">
            <label
              className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                bookingType === "boarding"
                  ? "border-[#8B6A4E] bg-[#F5EFE6]"
                  : "border-[#D9CBB8] bg-white hover:bg-[#FFFDF9]"
              }`}
            >
              <input
                type="radio"
                name="bookingType"
                value="boarding"
                checked={bookingType === "boarding"}
                onChange={() => onBookingTypeChange("boarding")}
                className="mr-3 accent-[#8B6A4E]"
              />

              <span className="font-semibold text-[#5C4033]">
                Home Boarding
              </span>

              <span className="mt-2 block text-sm text-[#8B6A4E]">
                An overnight stay with separate arrival and departure dates.
              </span>
            </label>

            <label
              className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                bookingType === "daycare"
                  ? "border-[#8B6A4E] bg-[#F5EFE6]"
                  : "border-[#D9CBB8] bg-white hover:bg-[#FFFDF9]"
              }`}
            >
              <input
                type="radio"
                name="bookingType"
                value="daycare"
                checked={bookingType === "daycare"}
                onChange={() => onBookingTypeChange("daycare")}
                className="mr-3 accent-[#8B6A4E]"
              />

              <span className="font-semibold text-[#5C4033]">
                Doggy Day Care
              </span>

              <span className="mt-2 block text-sm text-[#8B6A4E]">
                Care on one selected attendance date.
              </span>
            </label>
          </div>

          {bookingType === "daycare" && (
            <div className="mt-4">
              <FormSelect
                id="daycareSession"
                label="Day Care Session"
                value={daycareSession || ""}
                onChange={(event) =>
                  onDaycareSessionChange(
                    event.target.value as DaycareSessionType,
                  )
                }
                required
              >
                <option value="">Select a session</option>
                <option value="full_day">Full Day</option>
                <option value="half_day">Half Day</option>
              </FormSelect>
            </div>
          )}
        </section>

        {/* Admin-specific fields */}
        {additionalFields}

        {/* Availability calendar */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-[#5C4033] md:mb-6 md:text-2xl">
            {bookingType === "daycare" ? "Attendance Date" : "Stay Dates"}
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
                limited: isLimitedAvailabilityDate,
                unavailable: isUnavailableDate,
              }}
              modifiersClassNames={{
                available:
                  "bg-green-100 text-green-800 border border-green-300 hover:bg-green-200",
                limited:
                  "bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200",
                unavailable:
                  "bg-red-50 text-red-300 line-through cursor-not-allowed",
                selected: "bg-[#8B6A4E] text-white border border-[#8B6A4E]",
                range_start: "bg-[#8B6A4E] text-white border border-[#8B6A4E]",
                range_end: "bg-[#8B6A4E] text-white border border-[#8B6A4E]",
                range_middle:
                  "bg-[#E8DDCF] text-[#5C4033] border border-[#D9CBB8]",
              }}
              classNames={{
                months:
                  "flex flex-col md:flex-row justify-center gap-4 md:gap-6",
                month: "w-full max-w-xs md:max-w-lg",
                month_caption: "flex justify-center items-center mb-3 md:mb-4",
                caption_label: "text-lg md:text-xl font-bold text-[#5C4033]",
                nav: "flex items-center justify-between mb-4",
                button_previous:
                  "text-[#5C4033] hover:text-[#8B6A4E] hover:scale-110 transition-all duration-200",
                button_next:
                  "text-[#5C4033] hover:text-[#8B6A4E] hover:scale-110 transition-all duration-200",
                weekdays: "grid grid-cols-7 mb-2",
                weekday:
                  "text-center text-xs md:text-sm font-semibold text-[#8B6A4E]",
                week: "grid grid-cols-7 gap-2 md:gap-3 mb-1 md:mb-2",
                day: "h-8 w-8 md:h-9 md:w-9 flex items-center justify-center rounded-full text-xs md:text-sm font-medium transition-all duration-200",
                today: "ring-2 ring-[#8B6A4E] ring-offset-2",
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
                    {bookingType === "daycare"
                      ? "Selected attendance date"
                      : "Selected dates"}
                  </p>

                  <p className="mt-1 text-sm text-[#8B6A4E] md:text-base">
                    {bookingType === "daycare" ? "Attendance" : "Arrival"}:{" "}
                    {startDate ? formatDisplayDate(startDate) : "Not selected"}
                  </p>

                  {bookingType === "boarding" && (
                    <p className="text-sm text-[#8B6A4E] md:text-base">
                      Departure:{" "}
                      {endDate ? formatDisplayDate(endDate) : "Not selected"}
                    </p>
                  )}
                </div>

                <Button type="button" variant="light" onClick={onClearDates}>
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

              {projectedQuantity > 0 && projectedUnitRate !== null && (
                <p className="mt-2 text-sm text-[#8B6A4E] md:text-base">
                  {projectedQuantity} {projectedUnitLabel}
                  {projectedQuantity === 1 ? "" : "s"} at{" "}
                  {formatMoney(projectedUnitRate)}.
                </p>
              )}

              <p className="mt-1 text-sm text-[#8B6A4E] md:text-base">
                Estimated total cost: {formatMoney(projectedTotal)}
              </p>

              {isProjectedShortNotice ? (
                <p className="mt-3 text-xs font-medium text-amber-700 md:text-sm">
                  This booking starts within 14 days, so no deposit will be
                  requested. The full balance will be due if Browns Boarding
                  accepts the booking.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-[#8B6A4E] md:text-base">
                    Estimated deposit: {formatMoney(projectedDeposit)}
                  </p>

                  <p className="mt-1 text-sm text-[#8B6A4E] md:text-base">
                    Estimated remaining balance: {formatMoney(projectedBalance)}
                  </p>
                </>
              )}

              <p className="mt-3 text-xs italic text-[#8B6A4E] md:text-sm">
                This is an estimate only. Browns Boarding will confirm the final
                price before accepting your booking.
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
            onChange={(event) => onNotesChange(event.target.value)}
            rows={2}
          />
        </section>

        {/* Summary message */}
        {summaryMessage && (
          <section>
            <MessageBox type="info">{summaryMessage}</MessageBox>
          </section>
        )}

        {/* Result message */}
        {message && (
          <MessageBox type={isError ? "error" : "success"}>
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
            {saving ? savingLabel : submitLabel}
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
