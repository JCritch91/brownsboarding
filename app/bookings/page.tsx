"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { DateRange } from "react-day-picker";

import { supabase } from "@/lib/supabase";
import {
  getActivePricingSettings,
  getCurrentUser,
} from "@/lib/appActions";
import {
  formatMoney,
  formatDisplayDate,
  formatDateForDatabase,
  getDatesInRange,
  calculateNumberOfNights,
  isWithinTwoWeeks,
  validateBookingDates,
} from "@/lib/helpers";
import {
  calculateBookingPricing
} from "@/lib/services/booking-confirmation-service";

import {
  buildBookingConfirmationEmailPayload,
} from "@/lib/services/booking-payloads";

import CustomerPageLayout from "@/components/CustomerPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import MessageBox from "@/components/MessageBox";
import LoadingScreen from "@/components/LoadingScreen";
import BookingForm, {
  type BookingFormAvailability,
  type BookingFormDog,
} from "@/components/bookings/BookingForm";


export default function BookingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const [dogs, setDogs] = useState<BookingFormDog[]>([]);

  const [availability, setAvailability] =
    useState<BookingFormAvailability[]>([]);

  const [selectedDog, setSelectedDog] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();
  const [calendarMonths, setCalendarMonths] = useState(1);

  const [nightlyRate, setNightlyRate] = useState<number | null>(null);
  const [depositPercentage, setDepositPercentage] = useState<number | null>(
    null
  );

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
        "id, name, breed, meet_and_greet_completed, vaccinated, vaccination_expiry"
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
        setNightlyRate(Number(pricingData.nightly_rate));
        setDepositPercentage(Number(pricingData.deposit_percentage));
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
        (day) => day.date === selectedDate
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
    return true;
  }

  if (!dayAvailability.available) {
    return true;
  }

  if (dayAvailability.spaces_available <= 0) {
    return true;
  }

  return false;
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
    setSelectedRange(range);
    setMessage("");
    setIsError(false);

    if (!range?.from) {
      setStartDate("");
      setEndDate("");
      return;
    }

    setStartDate(formatDateForDatabase(range.from));

    if (range.to) {
      setEndDate(formatDateForDatabase(range.to));
    } else {
      setEndDate("");
    }
  }

  async function checkExistingBookingOverlap(
    dogId: string,
    newStartDate: string,
    newEndDate: string
  ) {
    const { data, error } = await supabase
      .from("bookings")
      .select("id, start_date, end_date, status")
      .eq("dog_id", dogId)
      .in("status", [
        "Pending",
        "Deposit Pending",
        "Balance Pending",
        "Balance Paid",
      ]);

    if (error) {
      return {
        hasOverlap: false,
        errorMessage: error.message,
      };
    }

    const hasOverlap = (data || []).some((booking) => {
      return (
        newStartDate <= booking.end_date &&
        newEndDate >= booking.start_date
      );
    });

    return {
      hasOverlap,
      errorMessage: "",
    };
  }

  function clearDateSelection() {
    setSelectedRange(undefined);
    setStartDate("");
    setEndDate("");
    setMessage("");
    setIsError(false);
  }

  async function handleBooking(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMessage("");
    setIsError(false);

    if (!selectedDog) {
      setIsError(true);
      setMessage("Please select a dog.");
      return;
    }

    const validationMessage = validateBookingDates(
      startDate,
      endDate
    );

    if (validationMessage) {
      setIsError(true);
      setMessage(validationMessage);
      return;
    }

    const dog = dogs.find((currentDog) => currentDog.id === selectedDog);

    if (!dog) {
      setIsError(true);
      setMessage("Unable to find selected dog.");
      return;
    }

    if (!dog.vaccinated) {
      setIsError(true);
      setMessage(
        "This dog cannot be booked because vaccination information is incomplete."
      );
      return;
    }

    if (dog.vaccination_expiry && dog.vaccination_expiry < startDate) {
      setIsError(true);
      setMessage(
        "This dog's vaccination will have expired before the booking starts."
      );
      return;
    }

    const availabilityCheck = checkAvailabilityForRange(startDate, endDate);

    if (!availabilityCheck.available) {
      setIsError(true);
      setMessage(availabilityCheck.message);
      return;
    }

    const existingBookingCheck = await checkExistingBookingOverlap(
      selectedDog,
      startDate,
      endDate
    );

    if (existingBookingCheck.errorMessage) {
      setIsError(true);
      setMessage(existingBookingCheck.errorMessage);
      return;
    }

    if (existingBookingCheck.hasOverlap) {
      setIsError(true);
      setMessage(
        "This dog already has a booking that overlaps with the selected dates. Please choose different dates or check My Bookings."
      );
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

    const { error } = await supabase.from("bookings").insert({
      owner_id: user.id,
      dog_id: selectedDog,
      start_date: startDate,
      end_date: endDate,
      status: "Pending",
      notes: notes.trim(),
      updated_at: new Date().toISOString(),
    });

    setSaving(false);

    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }

    setMessage(
      "Booking request submitted successfully. Browns Boarding will review your request and confirm the final cost and deposit details."
    );

    setSelectedDog("");
    setStartDate("");
    setEndDate("");
    setNotes("");
    setSelectedRange(undefined);
  }

  if (loading) {
    return <LoadingScreen message="Loading booking form..." />;
  }

  const projectedNights =
    startDate && endDate
      ? calculateNumberOfNights(startDate, endDate)
      : 0;

  const projectedTotal =
    nightlyRate && projectedNights ? nightlyRate * projectedNights : 0;

  const projectedDeposit =
    depositPercentage && projectedTotal
      ? projectedTotal * (depositPercentage / 100)
      : 0;

  const projectedBalance = projectedTotal - projectedDeposit;

  const isProjectedShortNotice = startDate
    ? isWithinTwoWeeks(startDate)
    : false;

  return (
    <CustomerPageLayout>
      <PageCard
        title="Book a Stay"
        subtitle="Select your dog and preferred boarding dates."
        actions={
          <Button href="/my-bookings">
            My Bookings
          </Button>
        }
      >
        {dogs.length === 0 ? (
          <div className="py-8 text-center md:py-12">
            <p className="text-sm text-[#8B6A4E] md:text-lg">
              You need to add a dog before requesting a booking.
            </p>

            <div className="mt-4 flex justify-center md:mt-6">
              <Button href="/my-dogs/add">
                Add Dog
              </Button>
            </div>
          </div>
        ) : (
          <BookingForm
            dogs={dogs}
            availability={availability}
            selectedDog={selectedDog}
            selectedRange={selectedRange}
            startDate={startDate}
            endDate={endDate}
            notes={notes}
            calendarMonths={calendarMonths}
            projectedNights={projectedNights}
            nightlyRate={nightlyRate}
            projectedTotal={projectedTotal}
            projectedDeposit={projectedDeposit}
            projectedBalance={projectedBalance}
            isProjectedShortNotice={isProjectedShortNotice}
            saving={saving}
            message={message}
            isError={isError}
            submitLabel="Request Booking"
            savingLabel="Submitting Request..."
            onDogChange={setSelectedDog}
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