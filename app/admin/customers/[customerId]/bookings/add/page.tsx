"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import type { DateRange } from "react-day-picker";

import { supabase } from "@/lib/supabase";
import {
  ensureActiveAdminUser,
  getActivePricingSettings,
} from "@/lib/appActions";
import {
  calculateNumberOfNights,
  formatDateForDatabase,
  formatDisplayDate,
  formatName,
  getDatesInRange,
  isWithinTwoWeeks,
  validateBookingDates,
} from "@/lib/helpers";
import { authenticatedApiRequest } from "@/lib/client/authenticated-api";

import AdminPageLayout from "@/components/AdminPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import LoadingScreen from "@/components/LoadingScreen";
import BookingForm, {
  type BookingFormAvailability,
  type BookingFormDog,
} from "@/components/bookings/BookingForm";
import type { BookingType, DaycareSessionType } from "@/types/booking";

type CreateAdminBookingResponse = {
  success: boolean;
  bookingCreated: boolean;
  booking?: {
    id: string;
    bookingReference: string;
    ownerId: string;
    dogId: string;
    dogIds: string[];
    bookingType: BookingType;
    daycareSession: DaycareSessionType | null;
    startDate: string;
    endDate: string;
    status: "Pending";
    notes?: string | null;
    spaceUnits: number;
    availabilityConfirmationRequired: boolean;
    createdAt?: string | null;
  };
  message?: string;
  error?: string;
};

type ConfirmAdminBookingResponse = {
  success: boolean;
  databaseConfirmed: boolean;
  followUpRequired: boolean;
  message?: string;
  error?: string;
};

type CustomerProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  active: boolean;
};

export default function AdminAddCustomerBookingPage() {
  const params = useParams<{
    customerId: string;
  }>();

  const customerId = params.customerId;

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [bookingMode, setBookingMode] = useState<"pending" | "confirmed">(
    "pending",
  );

  const [customer, setCustomer] = useState<CustomerProfile | null>(null);

  const [dogs, setDogs] = useState<BookingFormDog[]>([]);

  const [availability, setAvailability] = useState<BookingFormAvailability[]>(
    [],
  );

  const [selectedDogIds, setSelectedDogIds] = useState<string[]>([]);

  const [bookingType, setBookingType] = useState<BookingType>("boarding");

  const [daycareSession, setDaycareSession] =
    useState<DaycareSessionType | null>(null);

  const [startDate, setStartDate] = useState("");

  const [endDate, setEndDate] = useState("");

  const [notes, setNotes] = useState("");

  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();

  const [calendarMonths, setCalendarMonths] = useState(1);

  const [pricing, setPricing] = useState<{
    boardingNightlyRate: number;
    boardingDepositPercentage: number;
    daycareFullDayRate: number;
    daycareHalfDayRate: number;
    daycareDepositPercentage: number;
  } | null>(null);

  const [message, setMessage] = useState("");

  const [isError, setIsError] = useState(false);

  useEffect(() => {
    checkAdminAndLoadPage();
  }, [customerId]);

  useEffect(() => {
    function updateCalendarMonths() {
      setCalendarMonths(window.innerWidth >= 768 ? 2 : 1);
    }

    updateCalendarMonths();

    window.addEventListener("resize", updateCalendarMonths);

    return () => {
      window.removeEventListener("resize", updateCalendarMonths);
    };
  }, []);

  async function checkAdminAndLoadPage() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    const { redirectTo } = await ensureActiveAdminUser();

    if (redirectTo) {
      window.location.href = redirectTo;
      return;
    }

    await loadPageData();
  }

  async function loadPageData() {
    const today = new Date().toISOString().split("T")[0];

    const [
      { data: customerData, error: customerError },
      { data: dogsData, error: dogsError },
      { data: availabilityData, error: availabilityError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          `
          id,
          first_name,
          last_name,
          email,
          active
          `,
        )
        .eq("id", customerId)
        .or("is_admin.eq.false,is_admin.is.null")
        .maybeSingle(),

      supabase
        .from("dogs")
        .select(
          `
          id,
          name,
          breed,
          meet_and_greet_completed,
vaccinated,
vaccination_expiry,
can_share_with_other_dogs
          `,
        )
        .eq("owner_id", customerId)
        .eq("active", true)
        .order("name", {
          ascending: true,
        }),

      supabase
        .from("availability")
        .select(
          `
          id,
          date,
          available,
          total_spaces,
          spaces_available,
          notes
          `,
        )
        .gte("date", today)
        .order("date", {
          ascending: true,
        }),
    ]);

    if (customerError) {
      setIsError(true);
      setMessage(customerError.message);
      setLoading(false);
      return;
    }

    if (!customerData) {
      setIsError(true);
      setMessage("Customer could not be found.");
      setLoading(false);
      return;
    }

    if (dogsError) {
      setIsError(true);
      setMessage(dogsError.message);
      setLoading(false);
      return;
    }

    if (availabilityError) {
      setIsError(true);
      setMessage(availabilityError.message);
      setLoading(false);
      return;
    }

    try {
      const pricing = await getActivePricingSettings();

      if (!pricing) {
        throw new Error("No active pricing settings were found.");
      }

      setPricing({
        boardingNightlyRate: Number(pricing.nightly_rate),
        boardingDepositPercentage: Number(pricing.deposit_percentage),
        daycareFullDayRate: Number(pricing.daycare_full_day_rate),
        daycareHalfDayRate: Number(pricing.daycare_half_day_rate),
        daycareDepositPercentage: Number(pricing.daycare_deposit_percentage),
      });
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load pricing settings.",
      );
      setLoading(false);
      return;
    }

    setCustomer(customerData as CustomerProfile);

    setDogs((dogsData || []) as BookingFormDog[]);

    setAvailability((availabilityData || []) as BookingFormAvailability[]);

    setLoading(false);
  }

  function getCustomerName() {
    if (!customer) {
      return "Customer";
    }

    const firstName = formatName(customer.first_name || "");

    const lastName = formatName(customer.last_name || "");

    const fullName = `${firstName} ${lastName}`.trim();

    return fullName || customer.email || "Customer";
  }

  function findAvailabilityForDate(date: Date) {
    const dateKey = formatDateForDatabase(date);

    return availability.find(
      (availabilityRecord) => availabilityRecord.date === dateKey,
    );
  }

  function isPastDate(date: Date) {
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    return date < today;
  }

  function isUnavailableDate(date: Date) {
    const availabilityRecord = findAvailabilityForDate(date);

    if (!availabilityRecord) {
      return true;
    }

    return (
      !availabilityRecord.available || availabilityRecord.spaces_available <= 0
    );
  }

  function isLimitedAvailabilityDate(date: Date) {
    const availabilityRecord = findAvailabilityForDate(date);

    if (!availabilityRecord) {
      return false;
    }

    return (
      availabilityRecord.available &&
      availabilityRecord.spaces_available > 0 &&
      availabilityRecord.spaces_available < availabilityRecord.total_spaces
    );
  }

  function isGoodAvailabilityDate(date: Date) {
    const availabilityRecord = findAvailabilityForDate(date);

    if (!availabilityRecord) {
      return false;
    }

    return (
      availabilityRecord.available &&
      availabilityRecord.spaces_available > 0 &&
      availabilityRecord.spaces_available === availabilityRecord.total_spaces
    );
  }

  function handleDateRangeSelect(range: DateRange | undefined) {
    setMessage("");
    setIsError(false);

    if (!range?.from) {
      setSelectedRange(undefined);
      setStartDate("");
      setEndDate("");
      return;
    }

    const selectedDate = formatDateForDatabase(range.from);

    if (bookingType === "daycare") {
      setSelectedRange({
        from: range.from,
        to: range.from,
      });

      setStartDate(selectedDate);
      setEndDate(selectedDate);
      return;
    }

    setSelectedRange(range);
    setStartDate(selectedDate);

    if (range.to) {
      setEndDate(formatDateForDatabase(range.to));
    } else {
      setEndDate("");
    }
  }

  function handleBookingTypeChange(nextBookingType: BookingType) {
    setBookingType(nextBookingType);
    setMessage("");
    setIsError(false);
    setSelectedRange(undefined);
    setStartDate("");
    setEndDate("");

    if (nextBookingType === "boarding") {
      setDaycareSession(null);
    }
  }

  function clearDateSelection() {
    setSelectedRange(undefined);
    setStartDate("");
    setEndDate("");
    setMessage("");
    setIsError(false);
  }

  async function handleBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setMessage("");
    setIsError(false);

    if (!customer) {
      setIsError(true);
      setMessage("Customer could not be loaded.");
      return;
    }

    if (!customer.active) {
      setIsError(true);
      setMessage("A booking cannot be created for an inactive customer.");
      return;
    }

    if (selectedDogIds.length === 0) {
      setIsError(true);
      setMessage("Please select at least one dog.");
      return;
    }

    if (selectedDogIds.length > 2) {
      setIsError(true);
      setMessage("A booking can include no more than two dogs.");
      return;
    }

    if (bookingType === "daycare" && !daycareSession) {
      setIsError(true);
      setMessage("Please select a full-day or half-day daycare session.");
      return;
    }

    if (!startDate) {
      setIsError(true);
      setMessage(
        bookingType === "daycare"
          ? "Please select an attendance date."
          : "Please select an arrival date.",
      );
      return;
    }

    if (bookingType === "boarding" && (!endDate || endDate <= startDate)) {
      setIsError(true);
      setMessage("A Boarding booking must end after its arrival date.");
      return;
    }

    if (bookingType === "daycare" && endDate !== startDate) {
      setIsError(true);
      setMessage(
        "A Doggy Day Care booking must start and end on the same date.",
      );
      return;
    }

    const selectedDogs = selectedDogIds
      .map((dogId) => dogs.find((dog) => dog.id === dogId))
      .filter((dog): dog is BookingFormDog => Boolean(dog));

    if (selectedDogs.length !== selectedDogIds.length) {
      setIsError(true);
      setMessage("One or more selected dogs could not be found.");
      return;
    }

    const occupiedDates =
      bookingType === "daycare"
        ? [startDate]
        : getDatesInRange(startDate, endDate).slice(0, -1);

    const explicitlyUnavailableDate = occupiedDates.find((occupiedDate) => {
      const availabilityRecord = availability.find(
        (record) => record.date === occupiedDate,
      );

      return availabilityRecord && !availabilityRecord.available;
    });

    if (explicitlyUnavailableDate) {
      setIsError(true);
      setMessage(
        `${formatDisplayDate(
          explicitlyUnavailableDate,
        )} has been marked as unavailable.`,
      );
      return;
    }

    if (bookingMode === "confirmed" && !pricing) {
      setIsError(true);
      setMessage("The active pricing settings could not be loaded.");
      return;
    }

    setSaving(true);

    const creationResult =
      await authenticatedApiRequest<CreateAdminBookingResponse>(
        `/api/admin/customers/${customerId}/bookings/create`,
        {
          body: {
            dogIds: selectedDogIds,
            bookingType,
            daycareSession: bookingType === "daycare" ? daycareSession : null,
            startDate,
            endDate,
            notes,
          },
        },
      );

    if (creationResult.unauthenticated) {
      setSaving(false);
      window.location.href = "/login";
      return;
    }

    if (!creationResult.ok) {
      setSaving(false);
      setIsError(true);
      setMessage(creationResult.error || "The booking could not be created.");
      return;
    }

    if (
      !creationResult.data ||
      !creationResult.data.bookingCreated ||
      !creationResult.data.booking
    ) {
      setSaving(false);
      setIsError(true);
      setMessage(
        creationResult.data?.error ||
          "The booking service did not create the booking.",
      );
      return;
    }

    const newBooking = creationResult.data.booking;

    if (bookingMode === "pending") {
      setSaving(false);
      window.location.href = `/admin/customers/${customerId}`;
      return;
    }

    if (newBooking.availabilityConfirmationRequired) {
      setSaving(false);
      setIsError(false);
      setMessage(
        "The booking was created as Pending because one or more dates require an availability review. Confirm availability from Admin Bookings before confirming the booking.",
      );
      return;
    }

    const confirmationResult =
      await authenticatedApiRequest<ConfirmAdminBookingResponse>(
        "/api/admin/bookings/confirm",
        {
          body: {
            bookingId: newBooking.id,
          },
        },
      );

    setSaving(false);

    if (confirmationResult.unauthenticated) {
      window.location.href = "/login";
      return;
    }

    if (!confirmationResult.ok) {
      setIsError(true);
      setMessage(
        confirmationResult.error
          ? `The booking was created as Pending, but it could not be confirmed: ${confirmationResult.error}`
          : "The booking was created as Pending, but it could not be confirmed.",
      );
      return;
    }

    if (
      !confirmationResult.data ||
      !confirmationResult.data.databaseConfirmed
    ) {
      setIsError(true);
      setMessage(
        confirmationResult.data?.error ||
          "The booking was created as Pending, but the confirmation service did not confirm it.",
      );
      return;
    }

    if (confirmationResult.data.followUpRequired) {
      setIsError(true);
      setMessage(
        confirmationResult.data.message ||
          "The booking was confirmed, but one or more calendar or email operations could not be completed.",
      );
      return;
    }

    setIsError(false);

    window.location.href = `/admin/customers/${customerId}`;
  }

  const projectedQuantity =
    bookingType === "daycare"
      ? startDate
        ? 1
        : 0
      : startDate && endDate && endDate > startDate
        ? calculateNumberOfNights(startDate, endDate)
        : 0;

  const projectedUnitRate =
    bookingType === "boarding"
      ? (pricing?.boardingNightlyRate ?? null)
      : daycareSession === "full_day"
        ? (pricing?.daycareFullDayRate ?? null)
        : daycareSession === "half_day"
          ? (pricing?.daycareHalfDayRate ?? null)
          : null;

  const projectedUnitLabel =
    bookingType === "boarding"
      ? "night"
      : daycareSession === "half_day"
        ? "half day"
        : "full day";

  const projectedDepositPercentage =
    bookingType === "boarding"
      ? (pricing?.boardingDepositPercentage ?? null)
      : (pricing?.daycareDepositPercentage ?? null);

  const projectedTotal =
    projectedUnitRate !== null && projectedQuantity > 0
      ? projectedUnitRate * projectedQuantity
      : 0;

  const isProjectedShortNotice = startDate
    ? isWithinTwoWeeks(startDate)
    : false;

  const projectedDeposit = isProjectedShortNotice
    ? 0
    : projectedDepositPercentage !== null && projectedTotal > 0
      ? projectedTotal * (projectedDepositPercentage / 100)
      : 0;

  const projectedBalance = projectedTotal - projectedDeposit;

  if (loading) {
    return <LoadingScreen message="Preparing booking form..." />;
  }

  return (
    <AdminPageLayout>
      <PageCard
        title="Create Booking"
        subtitle={`Create a booking for ${getCustomerName()}.`}
        actions={
          <Button href={`/admin/customers/${customerId}`}>
            Back to Customer
          </Button>
        }
      >
        {dogs.length === 0 ? (
          <div className="py-8 text-center md:py-12">
            <p className="text-sm text-[#8B6A4E] md:text-lg">
              This customer needs an active dog before a booking can be created.
            </p>

            <div className="mt-4 flex justify-center md:mt-6">
              <Button href={`/admin/customers/${customerId}/dogs/add`}>
                Add Dog
              </Button>
            </div>
          </div>
        ) : (
          <BookingForm
            dogs={dogs}
            availability={availability}
            selectedDogIds={selectedDogIds}
            bookingType={bookingType}
            daycareSession={daycareSession}
            selectedRange={selectedRange}
            startDate={startDate}
            endDate={endDate}
            notes={notes}
            calendarMonths={calendarMonths}
            projectedQuantity={projectedQuantity}
            projectedUnitLabel={projectedUnitLabel}
            projectedUnitRate={projectedUnitRate}
            projectedTotal={projectedTotal}
            projectedDeposit={projectedDeposit}
            projectedBalance={projectedBalance}
            isProjectedShortNotice={isProjectedShortNotice}
            saving={saving}
            message={message}
            isError={isError}
            submitLabel={
              bookingMode === "confirmed"
                ? "Create & Confirm Booking"
                : "Create Booking Request"
            }
            savingLabel={
              bookingMode === "confirmed"
                ? "Confirming Booking..."
                : "Creating Booking..."
            }
            additionalFields={
              <section>
                <h2 className="mb-4 text-xl font-semibold text-[#5C4033] md:mb-6 md:text-2xl">
                  Booking Action
                </h2>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label
                    className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 ${
                      bookingMode === "pending"
                        ? "border-amber-400 bg-amber-50 ring-2 ring-amber-200"
                        : "border-[#D9CBB8] bg-white hover:bg-[#FFFDF9]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="bookingMode"
                        value="pending"
                        checked={bookingMode === "pending"}
                        onChange={() => setBookingMode("pending")}
                        className="mt-1 h-5 w-5 accent-[#8B6A4E]"
                      />

                      <div>
                        <p className="font-semibold text-[#5C4033]">
                          Create as Pending
                        </p>

                        <p className="mt-1 text-sm text-[#8B6A4E]">
                          Save the booking request without reducing
                          availability, creating calendar events or sending the
                          confirmation email.
                        </p>
                      </div>
                    </div>
                  </label>

                  <label
                    className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 ${
                      bookingMode === "confirmed"
                        ? "border-green-400 bg-green-50 ring-2 ring-green-200"
                        : "border-[#D9CBB8] bg-white hover:bg-[#FFFDF9]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="bookingMode"
                        value="confirmed"
                        checked={bookingMode === "confirmed"}
                        onChange={() => setBookingMode("confirmed")}
                        className="mt-1 h-5 w-5 accent-[#8B6A4E]"
                      />

                      <div>
                        <p className="font-semibold text-[#5C4033]">
                          Confirm Immediately
                        </p>

                        <p className="mt-1 text-sm text-[#8B6A4E]">
                          Apply pricing, reduce availability, update both Google
                          calendars and send the confirmation email.
                        </p>
                      </div>
                    </div>
                  </label>
                </div>
              </section>
            }
            cancelHref={`/admin/customers/${customerId}`}
            introductoryMessage={`Create a Boarding or Doggy Day Care booking for ${getCustomerName()}. Select one or two dogs from the customer's household, then choose whether to leave the booking Pending or confirm it immediately.`}
            summaryMessage={
              bookingMode === "confirmed"
                ? "This booking will be confirmed immediately when configured or compatible shared availability is available. If one or more dates require an availability review, the booking will remain Pending instead."
                : "This booking will be created as Pending. It can then be reviewed and confirmed from Admin Bookings."
            }
            onDogSelectionChange={setSelectedDogIds}
            onBookingTypeChange={handleBookingTypeChange}
            onDaycareSessionChange={setDaycareSession}
            onDateRangeSelect={handleDateRangeSelect}
            onClearDates={clearDateSelection}
            onNotesChange={setNotes}
            onSubmit={handleBooking}
            isPastDate={isPastDate}
            isUnavailableDate={isUnavailableDate}
            isLimitedAvailabilityDate={isLimitedAvailabilityDate}
            isGoodAvailabilityDate={isGoodAvailabilityDate}
          />
        )}
      </PageCard>
    </AdminPageLayout>
  );
}
