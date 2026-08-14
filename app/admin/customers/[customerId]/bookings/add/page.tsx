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

const {
  data: { session },
  error: sessionError,
} = await supabase.auth.getSession();

if (sessionError || !session) {
  setSaving(false);
  window.location.href = "/login";
  return;
}

/*
 * Every admin-created booking begins as Pending.
 *
 * If Confirm Immediately is selected, the secure
 * confirmation route will apply pricing, reduce
 * availability, update calendars and send email.
 */
const {
  data: newBooking,
  error: bookingCreateError,
} = await supabase
  .from("bookings")
  .insert({
    owner_id: customerId,
    dog_id: selectedDog,
    start_date: startDate,
    end_date: endDate,
    status: "Pending",
    notes: notes.trim() || null,
    updated_at: new Date().toISOString(),
  })
  .select(
    `
    id,
    booking_reference
    `
  )
  .single();

if (bookingCreateError || !newBooking) {
  setSaving(false);
  setIsError(true);
  setMessage(
    bookingCreateError?.message ||
      "Unable to create the booking."
  );
  return;
}

/*
 * Pending mode stops here. No availability,
 * calendar or email operations are performed.
 */
if (bookingMode === "pending") {
  setSaving(false);

  window.location.href =
    `/admin/customers/${customerId}`;

  return;
}

/*
 * Confirm Immediately uses the same secure route
 * as the Confirm Booking button on Admin Bookings.
 */
let confirmationResponse: Response;

try {
  confirmationResponse = await fetch(
    "/api/admin/bookings/confirm",
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bookingId: newBooking.id,
      }),
    }
  );
} catch (requestError) {
  setSaving(false);
  setIsError(true);
  setMessage(
    requestError instanceof Error
      ? `The booking was created as Pending, but the confirmation service could not be contacted: ${requestError.message}`
      : "The booking was created as Pending, but the confirmation service could not be contacted."
  );
  return;
}

const confirmationResult =
  await confirmationResponse
    .json()
    .catch(() => null);

/*
 * A failed confirmation leaves the newly created
 * booking as Pending. It can safely be confirmed
 * later from Admin Bookings.
 */
if (!confirmationResponse.ok) {
  setSaving(false);
  setIsError(true);
  setMessage(
    confirmationResult?.error
      ? `The booking was created as Pending, but it could not be confirmed: ${confirmationResult.error}`
      : "The booking was created as Pending, but it could not be confirmed."
  );
  return;
}

if (!confirmationResult?.databaseConfirmed) {
  setSaving(false);
  setIsError(true);
  setMessage(
    confirmationResult?.error ||
      "The booking was created as Pending, but the confirmation service did not confirm it."
  );
  return;
}

/*
 * HTTP 207 is still a successful database
 * confirmation, but one or more calendar or email
 * follow-up operations failed.
 */
if (confirmationResult.followUpRequired) {
  setSaving(false);
  setIsError(true);
  setMessage(
    confirmationResult.message ||
      "The booking was confirmed, but one or more calendar or email operations could not be completed."
  );
  return;
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