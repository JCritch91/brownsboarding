"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { DateRange } from "react-day-picker";

import { supabase } from "@/lib/supabase";
import { getActivePricingSettings, getCurrentUser } from "@/lib/appActions";
import {
  formatDisplayDate,
  formatDateForDatabase,
  getDatesInRange,
  calculateNumberOfNights,
  isWithinTwoWeeks,
} from "@/lib/helpers";
import CustomerPageLayout from "@/components/CustomerPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import LoadingScreen from "@/components/LoadingScreen";
import BookingForm, {
  type BookingFormDog,
} from "@/components/bookings/BookingForm";
import type { Availability } from "@/types/availability";
import { authenticatedApiRequest } from "@/lib/client/authenticated-api";
import type { BookingType, DaycareSessionType } from "@/types/booking";

type CreateBookingResponse = {
  success: boolean;
  bookingCreated: boolean;
  booking?: {
    id: string;
    bookingReference: string;
    ownerId: string;
    dogId: string;
    startDate: string;
    endDate: string;
    status: "Pending";
  };
  message?: string;
  error?: string;
};

export default function BookingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const [dogs, setDogs] = useState<BookingFormDog[]>([]);

  const [availability, setAvailability] = useState<Availability[]>([]);

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

  useEffect(() => {
    loadPageData();
  }, []);

  async function loadPageData() {
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

    const { data: dogsData, error: dogsError } = await supabase
      .from("dogs")
      .select(
        "id, name, breed, meet_and_greet_completed, vaccinated,vaccination_expiry,can_share_with_other_dogs",
      )
      .eq("owner_id", user.id)
      .eq("active", true)
      .order("name", { ascending: true });

    if (dogsError) {
      setIsError(true);
      setMessage(dogsError.message);
      setLoading(false);
      return;
    }

    setDogs(dogsData || []);

    const today = new Date().toISOString().split("T")[0];

    const { data: availabilityData, error: availabilityError } = await supabase
      .from("availability")
      .select("id, date, available, total_spaces, spaces_available, notes")
      .gte("date", today)
      .order("date", { ascending: true });

    if (availabilityError) {
      setIsError(true);
      setMessage(availabilityError.message);
      setLoading(false);
      return;
    }

    setAvailability(availabilityData || []);

    try {
      const pricingData = await getActivePricingSettings();

      if (pricingData) {
        setPricing({
          boardingNightlyRate: Number(pricingData.nightly_rate),
          boardingDepositPercentage: Number(pricingData.deposit_percentage),
          daycareFullDayRate: Number(pricingData.daycare_full_day_rate),
          daycareHalfDayRate: Number(pricingData.daycare_half_day_rate),
          daycareDepositPercentage: Number(
            pricingData.daycare_deposit_percentage,
          ),
        });
      }
    } catch (error) {
      setIsError(true);

      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("Unable to load pricing settings.");
      }

      setLoading(false);
      return;
    }

    setLoading(false);
  }

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

  function checkAvailabilityForRange(start: string, end: string) {
    const selectedDates = getDatesInRange(start, end);
    selectedDates.pop();

    for (const selectedDate of selectedDates) {
      const availabilityForDay = availability.find(
        (day) => day.date === selectedDate,
      );

      if (!availabilityForDay) {
        return {
          available: false,
          message: `No availability for ${formatDisplayDate(selectedDate)}.`,
        };
      }

      if (!availabilityForDay.available) {
        return {
          available: false,
          message: `${formatDisplayDate(selectedDate)} is not available for bookings.`,
        };
      }

      if (availabilityForDay.spaces_available <= 0) {
        return {
          available: false,
          message: `${formatDisplayDate(selectedDate)} is fully booked.`,
        };
      }
    }

    return {
      available: true,
      message: "",
    };
  }

  function findAvailabilityForDate(date: Date) {
    const dateKey = formatDateForDatabase(date);

    return availability.find((day) => day.date === dateKey);
  }

  function isPastDate(date: Date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return date < today;
  }

  function isUnavailableDate(date: Date) {
    const dayAvailability = findAvailabilityForDate(date);

    if (!dayAvailability) {
      return false;
    }

    return !dayAvailability.available;
  }

  function isLimitedAvailabilityDate(date: Date) {
    const dayAvailability = findAvailabilityForDate(date);

    if (!dayAvailability) {
      return false;
    }

    return (
      dayAvailability.available &&
      dayAvailability.spaces_available > 0 &&
      dayAvailability.spaces_available < dayAvailability.total_spaces
    );
  }

  function isGoodAvailabilityDate(date: Date) {
    const dayAvailability = findAvailabilityForDate(date);

    if (!dayAvailability) {
      return false;
    }

    return (
      dayAvailability.available &&
      dayAvailability.spaces_available > 0 &&
      dayAvailability.spaces_available === dayAvailability.total_spaces
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

    clearDateSelection();

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

    for (const dog of selectedDogs) {
      if (!dog.vaccinated) {
        setIsError(true);
        setMessage(`${dog.name}'s vaccination information is incomplete.`);
        return;
      }

      if (!dog.vaccination_expiry) {
        setIsError(true);
        setMessage(`${dog.name}'s vaccination expiry date is missing.`);
        return;
      }

      if (dog.vaccination_expiry < startDate) {
        setIsError(true);
        setMessage(
          `${dog.name}'s vaccination will have expired before the booking begins.`,
        );
        return;
      }
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
        `${explicitlyUnavailableDate} has been marked as unavailable.`,
      );
      return;
    }

    setSaving(true);

    const result = await authenticatedApiRequest<CreateBookingResponse>(
      "/api/bookings/create",
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

    setSaving(false);

    if (result.unauthenticated) {
      window.location.href = "/login";
      return;
    }

    if (!result.ok) {
      setIsError(true);
      setMessage(
        result.error || "Your booking request could not be submitted.",
      );
      return;
    }

    if (!result.data || !result.data.bookingCreated) {
      setIsError(true);
      setMessage(
        result.data?.error ||
          "The booking service did not create your booking request.",
      );
      return;
    }

    setIsError(false);

    setMessage(
      result.data.message ||
        "Booking request submitted successfully. Browns Boarding will review your request and confirm the final cost and payment details.",
    );

    setSelectedDogIds([]);
    setBookingType("boarding");
    setDaycareSession(null);
    setStartDate("");
    setEndDate("");
    setNotes("");
    setSelectedRange(undefined);
  }

  if (loading) {
    return <LoadingScreen message="Loading booking form..." />;
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

  return (
    <CustomerPageLayout>
      <PageCard
        title="Request a Booking"
        subtitle="Select one or two dogs, choose Home Boarding or Doggy Day Care, and enter your preferred dates."
        actions={<Button href="/my-bookings">My Bookings</Button>}
      >
        {dogs.length === 0 ? (
          <div className="py-8 text-center md:py-12">
            <p className="text-sm text-[#8B6A4E] md:text-lg">
              You need to add a dog before requesting a booking.
            </p>

            <div className="mt-4 flex justify-center md:mt-6">
              <Button href="/my-dogs/add">Add Dog</Button>
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
            submitLabel="Request Booking"
            savingLabel="Submitting Request..."
            introductoryMessage="You can include one or two dogs from your household in the same booking request. Dates shown without configured availability can still be requested, and Browns Boarding will confirm whether they can be accommodated."
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
    </CustomerPageLayout>
  );
}
