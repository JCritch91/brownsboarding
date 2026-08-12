"use client";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
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
  formatMoney,
  getDatesInRange,
  isWithinTwoWeeks,
  validateBookingDates,
} from "@/lib/helpers";


import AdminPageLayout from "@/components/AdminPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import LoadingScreen from "@/components/LoadingScreen";
import BookingForm, {
  type BookingFormAvailability,
  type BookingFormDog,
} from "@/components/bookings/BookingForm";

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

  const [bookingMode, setBookingMode] = useState<
    "pending" | "confirmed"
  >("pending");

  const [customer, setCustomer] =
    useState<CustomerProfile | null>(null);

  const [dogs, setDogs] =
    useState<BookingFormDog[]>([]);

  const [availability, setAvailability] =
    useState<BookingFormAvailability[]>([]);

  const [selectedDog, setSelectedDog] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  const [selectedRange, setSelectedRange] =
    useState<DateRange | undefined>();

  const [calendarMonths, setCalendarMonths] =
    useState(1);

  const [nightlyRate, setNightlyRate] =
    useState<number | null>(null);

  const [pricingSettingId, setPricingSettingId] =
  useState<string | null>(null);

  const [depositPercentage, setDepositPercentage] =
    useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    checkAdminAndLoadPage();
  }, [customerId]);

  useEffect(() => {
    function updateCalendarMonths() {
      setCalendarMonths(
        window.innerWidth >= 768 ? 2 : 1
      );
    }

    updateCalendarMonths();

    window.addEventListener(
      "resize",
      updateCalendarMonths
    );

    return () => {
      window.removeEventListener(
        "resize",
        updateCalendarMonths
      );
    };
  }, []);

  async function checkAdminAndLoadPage() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    const { redirectTo } =
      await ensureActiveAdminUser();

    if (redirectTo) {
      window.location.href = redirectTo;
      return;
    }

    await loadPageData();
  }

  async function loadPageData() {
    const today =
      new Date().toISOString().split("T")[0];

    const [
      { data: customerData, error: customerError },
      { data: dogsData, error: dogsError },
      {
        data: availabilityData,
        error: availabilityError,
      },
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
          `
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
          vaccination_expiry
          `
        )
        .eq("owner_id", customerId)
        .eq("active", true)
        .order("name", { ascending: true }),

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
          `
        )
        .gte("date", today)
        .order("date", { ascending: true }),
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
      const pricing =
        await getActivePricingSettings();

      if (!pricing) {
        throw new Error(
          "No active pricing settings were found."
        );
      }

    setPricingSettingId(pricing.id);

    setNightlyRate(
      Number(pricing.nightly_rate)
    );

    setDepositPercentage(
      Number(pricing.deposit_percentage)
    );
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load pricing settings."
      );
      setLoading(false);
      return;
    }

    setCustomer(customerData as CustomerProfile);

    setDogs(
      (dogsData || []) as BookingFormDog[]
    );

    setAvailability(
      (availabilityData ||
        []) as BookingFormAvailability[]
    );

    setLoading(false);
  }

  function getCustomerName() {
    if (!customer) {
      return "Customer";
    }

    const firstName = formatName(
      customer.first_name || ""
    );

    const lastName = formatName(
      customer.last_name || ""
    );

    const fullName =
      `${firstName} ${lastName}`.trim();

    return (
      fullName ||
      customer.email ||
      "Customer"
    );
  }

  function findAvailabilityForDate(date: Date) {
    const dateKey = formatDateForDatabase(date);

    return availability.find(
      (availabilityRecord) =>
        availabilityRecord.date === dateKey
    );
  }

  function isPastDate(date: Date) {
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    return date < today;
  }

  function isUnavailableDate(date: Date) {
    const availabilityRecord =
      findAvailabilityForDate(date);

    if (!availabilityRecord) {
      return true;
    }

    return (
      !availabilityRecord.available ||
      availabilityRecord.spaces_available <= 0
    );
  }

  function isLimitedAvailabilityDate(
    date: Date
  ) {
    const availabilityRecord =
      findAvailabilityForDate(date);

    if (!availabilityRecord) {
      return false;
    }

    return (
      availabilityRecord.available &&
      availabilityRecord.spaces_available > 0 &&
      availabilityRecord.spaces_available <
        availabilityRecord.total_spaces
    );
  }

  function isGoodAvailabilityDate(date: Date) {
    const availabilityRecord =
      findAvailabilityForDate(date);

    if (!availabilityRecord) {
      return false;
    }

    return (
      availabilityRecord.available &&
      availabilityRecord.spaces_available > 0 &&
      availabilityRecord.spaces_available ===
        availabilityRecord.total_spaces
    );
  }

  function handleDateRangeSelect(
    range: DateRange | undefined
  ) {
    setSelectedRange(range);
    setMessage("");
    setIsError(false);

    if (!range?.from) {
      setStartDate("");
      setEndDate("");
      return;
    }

    setStartDate(
      formatDateForDatabase(range.from)
    );

    setEndDate(
      range.to
        ? formatDateForDatabase(range.to)
        : ""
    );
  }

  function clearDateSelection() {
    setSelectedRange(undefined);
    setStartDate("");
    setEndDate("");
    setMessage("");
    setIsError(false);
  }

  function checkAvailabilityForRange(
    rangeStartDate: string,
    rangeEndDate: string
  ) {
    const occupiedDates = getDatesInRange(
      rangeStartDate,
      rangeEndDate
    );

    /*
     * The departure date is excluded because the dog
     * does not occupy a boarding space that night.
     */
    occupiedDates.pop();

    for (const occupiedDate of occupiedDates) {
      const availabilityRecord =
        availability.find(
          (record) =>
            record.date === occupiedDate
        );

      if (!availabilityRecord) {
        return {
          available: false,
          message: `No availability has been configured for ${formatDisplayDate(
            occupiedDate
          )}.`,
        };
      }

      if (!availabilityRecord.available) {
        return {
          available: false,
          message: `${formatDisplayDate(
            occupiedDate
          )} is unavailable.`,
        };
      }

      if (
        availabilityRecord.spaces_available <= 0
      ) {
        return {
          available: false,
          message: `${formatDisplayDate(
            occupiedDate
          )} is fully booked.`,
        };
      }
    }

    return {
      available: true,
      message: "",
    };
  }

  async function checkExistingBookingOverlap(
    dogId: string,
    newStartDate: string,
    newEndDate: string
  ) {
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id, start_date, end_date, status"
      )
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

    const hasOverlap = (data || []).some(
      (existingBooking) =>
        newStartDate <
          existingBooking.end_date &&
        newEndDate >
          existingBooking.start_date
    );

    return {
      hasOverlap,
      errorMessage: "",
    };
  }

async function handleBooking(
  event: FormEvent<HTMLFormElement>
) {
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
    setMessage(
      "A booking cannot be created for an inactive customer."
    );
    return;
  }

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

  const dog = dogs.find(
    (currentDog) => currentDog.id === selectedDog
  );

  if (!dog) {
    setIsError(true);
    setMessage("Unable to find the selected dog.");
    return;
  }

  if (!dog.vaccinated) {
    setIsError(true);
    setMessage(
      "This dog cannot be booked because its vaccination information is incomplete."
    );
    return;
  }

  if (
    dog.vaccination_expiry &&
    dog.vaccination_expiry < startDate
  ) {
    setIsError(true);
    setMessage(
      "This dog's vaccination will have expired before the booking begins."
    );
    return;
  }

  const availabilityCheck = checkAvailabilityForRange(
    startDate,
    endDate
  );

  if (!availabilityCheck.available) {
    setIsError(true);
    setMessage(availabilityCheck.message);
    return;
  }

  const overlapCheck = await checkExistingBookingOverlap(
    selectedDog,
    startDate,
    endDate
  );

  if (overlapCheck.errorMessage) {
    setIsError(true);
    setMessage(overlapCheck.errorMessage);
    return;
  }

  if (overlapCheck.hasOverlap) {
    setIsError(true);
    setMessage(
      "This dog already has a booking that overlaps with the selected dates."
    );
    return;
  }

  if (
    bookingMode === "confirmed" &&
    (
      nightlyRate === null ||
      depositPercentage === null ||
      !pricingSettingId
    )
  ) {
    setIsError(true);
    setMessage(
      "The active pricing settings could not be loaded."
    );
    return;
  }

  const shortNoticeBooking =
    bookingMode === "confirmed" &&
    isWithinTwoWeeks(startDate);

  const initialStatus =
    bookingMode === "confirmed"
      ? shortNoticeBooking
        ? "Balance Pending"
        : "Deposit Pending"
      : "Pending";

  const numberOfNights = calculateNumberOfNights(
    startDate,
    endDate
  );

  const totalCost =
    bookingMode === "confirmed" && nightlyRate !== null
      ? numberOfNights * nightlyRate
      : null;

  const depositAmount =
    bookingMode === "confirmed" &&
    totalCost !== null &&
    depositPercentage !== null
      ? shortNoticeBooking
        ? 0
        : totalCost * (depositPercentage / 100)
      : null;

  const balanceAmount =
    totalCost !== null && depositAmount !== null
      ? totalCost - depositAmount
      : null;

  setSaving(true);

  const { data: bookingData, error: bookingError } =
    await supabase
      .from("bookings")
      .insert({
        owner_id: customerId,
        dog_id: selectedDog,
        start_date: startDate,
        end_date: endDate,
        status: initialStatus,
        notes: notes.trim() || null,

        pricing_setting_id:
          bookingMode === "confirmed"
            ? pricingSettingId
            : null,

        nightly_rate:
          bookingMode === "confirmed"
            ? nightlyRate
            : null,

        number_of_nights:
          bookingMode === "confirmed"
            ? numberOfNights
            : null,

        total_cost: totalCost,
        deposit_amount: depositAmount,
        balance_amount: balanceAmount,

        updated_at: new Date().toISOString(),
      })
      .select(
        `
        id,
        booking_reference
        `
      )
      .single();

  if (bookingError || !bookingData) {
    setSaving(false);
    setIsError(true);
    setMessage(
      bookingError?.message ||
        "Unable to create the booking."
    );
    return;
  }

  if (bookingMode === "confirmed") {
    const { error: availabilityError } =
      await supabase.rpc(
        "adjust_availability_for_booking",
        {
          p_start_date: startDate,
          p_end_date: endDate,
          p_change: -1,
        }
      );

    if (availabilityError) {
      await supabase
        .from("bookings")
        .delete()
        .eq("id", bookingData.id);

      setSaving(false);
      setIsError(true);
      setMessage(
        `The booking could not be confirmed because availability could not be updated: ${availabilityError.message}`
      );
      return;
    }

    const { data: updatedAvailability, error: loadError } =
      await supabase
        .from("availability")
        .select(
          `
          id,
          date,
          available,
          total_spaces,
          spaces_available,
          notes
          `
        )
        .gte("date", startDate)
        .lt("date", endDate)
        .order("date", { ascending: true });

    if (loadError) {
      setSaving(false);
      setIsError(true);
      setMessage(
        `The booking was confirmed, but the updated availability dates could not be loaded: ${loadError.message}`
      );
      return;
    }

    let availabilityCalendarFailures = 0;

    for (const availabilityRecord of updatedAvailability || []) {
      try {
        const calendarResponse = await fetch(
          "/api/google/sync-availability-event",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              availabilityId: availabilityRecord.id,
              date: availabilityRecord.date,
              available: availabilityRecord.available,
              totalSpaces:
                availabilityRecord.total_spaces,
              spacesAvailable:
                availabilityRecord.spaces_available,
              notes: availabilityRecord.notes,
            }),
          }
        );

        if (!calendarResponse.ok) {
          availabilityCalendarFailures += 1;

          console.error(
            `Availability calendar sync failed for ${availabilityRecord.date}:`,
            await calendarResponse.text()
          );
        }
      } catch (calendarError) {
        availabilityCalendarFailures += 1;

        console.error(
          `Availability calendar sync failed for ${availabilityRecord.date}:`,
          calendarError
        );
      }
    }

    const paymentStatus = shortNoticeBooking
      ? "Full balance due"
      : "Deposit due";

    const bookingCalendarResponse = await fetch(
      "/api/google/create-booking-event",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId: bookingData.id,
          bookingReference:
            bookingData.booking_reference,
          ownerName: getCustomerName(),
          ownerEmail: customer.email || null,
          dogName: formatName(dog.name) || "Dog",
          dogBreed: dog.breed
            ? formatName(dog.breed)
            : null,
          startDate,
          endDate,
          bookingStatus: initialStatus,
          paymentStatus,
          totalCost:
            totalCost !== null
              ? formatMoney(totalCost)
              : null,
          depositAmount:
            depositAmount !== null
              ? formatMoney(depositAmount)
              : null,
          balanceAmount:
            balanceAmount !== null
              ? formatMoney(balanceAmount)
              : null,
          notes: notes.trim() || null,
        }),
      }
    );

    if (!bookingCalendarResponse.ok) {
      setSaving(false);

      const calendarErrorText =
        await bookingCalendarResponse.text();

      console.error(
        "Google booking calendar creation failed:",
        calendarErrorText
      );

      setIsError(true);
      setMessage(
        "The booking was confirmed and availability was reduced, but the Google booking event could not be created."
      );
      return;
    }

    const emailResponse = await fetch(
      "/api/send-booking-confirmation-email",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingReference:
            bookingData.booking_reference,
          customerEmail: customer.email,
          customerName: getCustomerName(),
          dogName:
            formatName(dog.name) || "your dog",
          startDate:
            formatDisplayDate(startDate),
          endDate:
            formatDisplayDate(endDate),
          totalCost:
            totalCost !== null
              ? formatMoney(totalCost)
              : null,
          depositAmount:
            depositAmount !== null
              ? formatMoney(depositAmount)
              : null,
          balanceAmount:
            balanceAmount !== null
              ? formatMoney(balanceAmount)
              : null,
          shortNoticeBooking,
        }),
      }
    );

    if (!emailResponse.ok) {
      setSaving(false);
      setIsError(true);
      setMessage(
        "The booking was confirmed and added to Google Calendar, but the confirmation email could not be sent."
      );
      return;
    }

    if (availabilityCalendarFailures > 0) {
      setSaving(false);
      setIsError(true);
      setMessage(
        `The booking was confirmed, but ${availabilityCalendarFailures} availability calendar event(s) could not be updated.`
      );
      return;
    }
  }

  setSaving(false);

  window.location.href =
    `/admin/customers/${customerId}`;
}

    const projectedNights =
    startDate && endDate
        ? calculateNumberOfNights(startDate, endDate)
        : 0;

    const projectedTotal =
    nightlyRate && projectedNights > 0
        ? nightlyRate * projectedNights
        : 0;

    const projectedDeposit =
    depositPercentage && projectedTotal > 0
        ? projectedTotal * (depositPercentage / 100)
        : 0;

    const projectedBalance =
    projectedTotal - projectedDeposit;

    const isProjectedShortNotice = startDate
    ? isWithinTwoWeeks(startDate)
    : false;

    if (loading) {
    return (
        <LoadingScreen message="Preparing booking form..." />
    );
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
                    This customer needs an active dog before a
                    booking can be created.
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
            isProjectedShortNotice={
                isProjectedShortNotice
            }
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
                          Save the booking request without reducing availability,
                          creating calendar events or sending the confirmation email.
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
            introductoryMessage={`Create a booking for ${getCustomerName()}. Choose whether to leave it pending or confirm it immediately.`}
            summaryMessage={
              bookingMode === "confirmed"
                ? "This booking will be confirmed immediately. Availability will be reduced, Google Calendar will be updated and the customer will receive a confirmation email."
                : "This booking will be created as Pending. It can then be reviewed and confirmed from Admin Bookings."
            }
            onDogChange={setSelectedDog}
            onDateRangeSelect={
                handleDateRangeSelect
            }
            onClearDates={clearDateSelection}
            onNotesChange={setNotes}
            onSubmit={handleBooking}
            isPastDate={isPastDate}
            isUnavailableDate={isUnavailableDate}
            isLimitedAvailabilityDate={
                isLimitedAvailabilityDate
            }
            isGoodAvailabilityDate={
                isGoodAvailabilityDate
            }
            />
        )}
        </PageCard>
    </AdminPageLayout>
    );
}