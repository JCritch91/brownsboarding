"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ensureActiveAdminUser } from "@/lib/appActions";
import AdminPageLayout from "@/components/AdminPageLayout";
import PageCard from "@/components/PageCard";
import MessageBox from "@/components/MessageBox";
import LoadingScreen from "@/components/LoadingScreen";
import { isWithinTwoWeeks } from "@/lib/helpers";
import type {
  Booking,
  BookingCustomerSummary,
  BookingFilter,
  BookingWithCustomer,
} from "@/types/booking";
import AdminBookingCard from "@/components/bookings/AdminBookingCard";
import BookingStatusSummary from "@/components/bookings/BookingStatusSummary";
import BookingStatusFilters from "@/components/bookings/BookingStatusFilters";


export default function AdminBookingsPage() {
const [loading, setLoading] = useState(true);

const [bookings, setBookings] =
  useState<BookingWithCustomer[]>([]);

const [message, setMessage] = useState("");
const [isError, setIsError] = useState(false);

const [selectedFilter, setSelectedFilter] =
  useState<BookingFilter>("All");


  useEffect(() => {
    checkAdminAndLoadBookings();
  }, []);

  async function checkAdminAndLoadBookings() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    const { redirectTo } = await ensureActiveAdminUser();

    if (redirectTo) {
      window.location.href = redirectTo;
      return;
    }

    await autoCompleteEligibleBookings();
    await loadBookings();

    setLoading(false);
  }

  async function loadBookings() {
    setMessage("");
    setIsError(false);

    const { data, error } = await supabase
      .from("bookings")
      .select(
        `
        id,
        booking_reference,
        owner_id,
        dog_id,
        start_date,
        end_date,
        status,
        notes,
        created_at,
        pricing_setting_id,
        nightly_rate,
        number_of_nights,
        total_cost,
        deposit_amount,
        balance_amount,
        deposit_paid_at,
        balance_paid_at,
        dogs (
          name,
          breed
        )
        `
      )
      .order("start_date", { ascending: true });

    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }

    const bookingData = (data ?? []) as unknown as Booking[];

    const ownerIds = Array.from(
      new Set(bookingData.map((booking) => booking.owner_id))
    );

    let profiles: BookingCustomerSummary[] = [];

    if (ownerIds.length > 0) {
      const { data: profileData, error: profileLoadError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", ownerIds);

      if (profileLoadError) {
        setIsError(true);
        setMessage(profileLoadError.message);
        return;
      }

      profiles = profileData || [];
    }

    const bookingsWithCustomers = bookingData.map((booking) => {
      const customer = profiles.find(
        (profile) => profile.id === booking.owner_id
      );

      return {
        ...booking,
        customer: customer || null,
      };
    });

    setBookings(bookingsWithCustomers);
  }

  function getCustomerName(booking: BookingWithCustomer) {
    const firstName = booking.customer?.first_name || "";
    const lastName = booking.customer?.last_name || "";

    const fullName = `${firstName} ${lastName}`.trim();

    return fullName || booking.customer?.email || "Customer";
  }

  async function confirmBooking(
  booking: BookingWithCustomer
) {

  const shortNoticeBooking = isWithinTwoWeeks(
    booking.start_date
  );

  const confirmed = window.confirm(
    shortNoticeBooking
      ? "This booking starts within 14 days.\n\nConfirming this booking will skip the deposit stage and move it straight to Balance Pending.\n\nDo you wish to continue?"
      : "Are you sure you want to confirm this booking?\n\nThis will calculate the cost, reduce availability, update Google Calendar and send the customer a confirmation email."
  );

  if (!confirmed) {
    return;
  }

  setMessage("");
  setIsError(false);

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    window.location.href = "/login";
    return;
  }

  let response: Response;

  try {
    response = await fetch(
      "/api/admin/bookings/confirm",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId: booking.id,
        }),
      }
    );
  } catch (requestError) {
    setIsError(true);
    setMessage(
      requestError instanceof Error
        ? requestError.message
        : "Unable to contact the booking confirmation service."
    );
    return;
  }

  const result = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    setIsError(true);
    setMessage(
      result?.error ||
        "The booking could not be confirmed."
    );

    await loadBookings();
    return;
  }

  if (!result?.databaseConfirmed) {
    setIsError(true);
    setMessage(
      result?.error ||
        "The confirmation service did not confirm the booking."
    );

    await loadBookings();
    return;
  }

  if (result.followUpRequired) {
    setIsError(true);
    setMessage(
      result.message ||
        "The booking was confirmed, but one or more calendar or email operations could not be completed."
    );

    await loadBookings();
    return;
  }

  setIsError(false);
  setMessage(
    result.message ||
      "Booking confirmed successfully."
  );

  await loadBookings();
}


async function cancelBooking(
  booking: BookingWithCustomer
) {
  const confirmed = window.confirm(
    `Are you sure you want to cancel booking ${booking.booking_reference}?\n\n${
      booking.status === "Pending"
        ? "This Pending booking has not reduced availability."
        : "Availability will be restored for each occupied night."
    }`
  );

  if (!confirmed) {
    return;
  }

  setMessage("");
  setIsError(false);

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    window.location.href = "/login";
    return;
  }

  let response: Response;

  try {
    response = await fetch(
      "/api/bookings/cancel",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId: booking.id,
        }),
      }
    );
  } catch (requestError) {
    setIsError(true);
    setMessage(
      requestError instanceof Error
        ? requestError.message
        : "Unable to contact the booking cancellation service."
    );
    return;
  }

  const result = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    setIsError(true);
    setMessage(
      result?.error ||
        "The booking could not be cancelled."
    );

    await loadBookings();
    return;
  }

  if (!result?.databaseCancelled) {
    setIsError(true);
    setMessage(
      result?.error ||
        "The cancellation service did not cancel the booking."
    );

    await loadBookings();
    return;
  }

  if (result.followUpRequired) {
    setIsError(true);
    setMessage(
      result.message ||
        "The booking was cancelled, but one or more calendar or email operations could not be completed."
    );

    await loadBookings();
    return;
  }

  setIsError(false);
  setMessage(
    result.message ||
      "Booking cancelled successfully."
  );

  await loadBookings();
}

async function markDepositPaid(
  booking: BookingWithCustomer
) {
  if (booking.status !== "Deposit Pending") {
    setIsError(true);
    setMessage(
      "This booking is no longer awaiting a deposit."
    );
    return;
  }

  const today = new Date();

  const todayFormatted = [
    String(today.getDate()).padStart(2, "0"),
    String(today.getMonth() + 1).padStart(2, "0"),
    today.getFullYear(),
  ].join("/");

  const depositPaidDateDisplay = window.prompt(
    "Enter the date the deposit was paid (DD/MM/YYYY):",
    todayFormatted
  );

  if (!depositPaidDateDisplay) {
    return;
  }

  const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;

  if (!datePattern.test(depositPaidDateDisplay)) {
    setIsError(true);
    setMessage(
      "Please enter the deposit paid date in DD/MM/YYYY format."
    );
    return;
  }

const [day, month, year] =
  depositPaidDateDisplay.split("/");

  const depositPaidDate = new Date(
    `${year}-${month}-${day}T00:00:00Z`
  );

  if (
    Number.isNaN(depositPaidDate.getTime()) ||
    depositPaidDate.getUTCDate() !== Number(day) ||
    depositPaidDate.getUTCMonth() + 1 !==
      Number(month) ||
    depositPaidDate.getUTCFullYear() !==
      Number(year)
  ) {
    setIsError(true);
    setMessage(
      "Please enter a valid deposit paid date."
    );
    return;
  }

  const todayDate = new Date();
  todayDate.setHours(23, 59, 59, 999);

  if (depositPaidDate > todayDate) {
    setIsError(true);
    setMessage(
      "The deposit paid date cannot be in the future."
    );
    return;
  }

  const depositPaidDateDb =
    `${year}-${month}-${day}`;

  const confirmed = window.confirm(
    `Confirm the deposit was paid on ${depositPaidDateDisplay}?\n\nThis will move the booking to Balance Pending, create the payment record, update Google Calendar and send a deposit receipt to the customer.`
  );

  if (!confirmed) {
    return;
  }

  setMessage("");
  setIsError(false);

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    window.location.href = "/login";
    return;
  }

  let response: Response;

  try {
    response = await fetch(
      "/api/admin/bookings/record-payment",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId: booking.id,
          paymentType: "Deposit",
          paymentDate: depositPaidDateDb,
        }),
      }
    );
  } catch (requestError) {
    setIsError(true);
    setMessage(
      requestError instanceof Error
        ? requestError.message
        : "Unable to contact the payment service."
    );
    return;
  }

  const result = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    setIsError(true);
    setMessage(
      result?.error ||
        "The deposit payment could not be recorded."
    );

    await loadBookings();
    return;
  }

  if (!result?.paymentRecorded) {
    setIsError(true);
    setMessage(
      result?.error ||
        "The payment service did not record the deposit."
    );

    await loadBookings();
    return;
  }

  /*
   * HTTP 207 means the database payment succeeded,
   * but the calendar or receipt email failed.
   */
  if (result.followUpRequired) {
    setIsError(true);
    setMessage(
      result.message ||
        "The deposit was recorded, but the calendar or receipt email could not be completed."
    );

    await loadBookings();
    return;
  }

  setIsError(false);
  setMessage(
    result.message ||
      "The deposit was recorded successfully."
  );

  await loadBookings();
}

async function markBalancePaid(
  booking: BookingWithCustomer
) {
  if (booking.status !== "Balance Pending") {
    setIsError(true);
    setMessage(
      "This booking is no longer awaiting its balance."
    );
    return;
  }

  const today = new Date();

  const todayFormatted = [
    String(today.getDate()).padStart(2, "0"),
    String(today.getMonth() + 1).padStart(2, "0"),
    today.getFullYear(),
  ].join("/");

  const balancePaidDateDisplay = window.prompt(
    "Enter the date the balance was paid (DD/MM/YYYY):",
    todayFormatted
  );

  if (!balancePaidDateDisplay) {
    return;
  }

  const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;

  if (!datePattern.test(balancePaidDateDisplay)) {
    setIsError(true);
    setMessage(
      "Please enter the balance paid date in DD/MM/YYYY format."
    );
    return;
  }

  const [day, month, year] =
    balancePaidDateDisplay.split("/");

  const balancePaidDate = new Date(
    `${year}-${month}-${day}T00:00:00Z`
  );

  if (
    Number.isNaN(balancePaidDate.getTime()) ||
    balancePaidDate.getUTCDate() !== Number(day) ||
    balancePaidDate.getUTCMonth() + 1 !==
      Number(month) ||
    balancePaidDate.getUTCFullYear() !== Number(year)
  ) {
    setIsError(true);
    setMessage(
      "Please enter a valid balance paid date."
    );
    return;
  }

  const todayDate = new Date();
  todayDate.setHours(23, 59, 59, 999);

  if (balancePaidDate > todayDate) {
    setIsError(true);
    setMessage(
      "The balance paid date cannot be in the future."
    );
    return;
  }

  const balancePaidDateDb =
    `${year}-${month}-${day}`;

  const confirmed = window.confirm(
    `Confirm the remaining balance was paid on ${balancePaidDateDisplay}?\n\nThis will move the booking to Balance Paid, create the payment record, update Google Calendar and send a balance receipt to the customer.`
  );

  if (!confirmed) {
    return;
  }

  setMessage("");
  setIsError(false);

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    window.location.href = "/login";
    return;
  }

  let response: Response;

  try {
    response = await fetch(
      "/api/admin/bookings/record-payment",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId: booking.id,
          paymentType: "Balance",
          paymentDate: balancePaidDateDb,
        }),
      }
    );
  } catch (requestError) {
    setIsError(true);
    setMessage(
      requestError instanceof Error
        ? requestError.message
        : "Unable to contact the payment service."
    );
    return;
  }

  const result = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    setIsError(true);
    setMessage(
      result?.error ||
        "The balance payment could not be recorded."
    );

    await loadBookings();
    return;
  }

  if (!result?.paymentRecorded) {
    setIsError(true);
    setMessage(
      result?.error ||
        "The payment service did not record the balance."
    );

    await loadBookings();
    return;
  }

  /*
   * HTTP 207 means the database payment succeeded,
   * but the calendar or receipt email failed.
   */
  if (result.followUpRequired) {
    setIsError(true);
    setMessage(
      result.message ||
        "The balance was recorded, but the calendar or receipt email could not be completed."
    );

    await loadBookings();
    return;
  }

  setIsError(false);
  setMessage(
    result.message ||
      "The balance was recorded successfully."
  );

  await loadBookings();
}

async function autoCompleteEligibleBookings() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    window.location.href = "/login";
    return;
  }

  let response: Response;

  try {
    response = await fetch(
      "/api/admin/bookings/complete",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (requestError) {
    setIsError(true);
    setMessage(
      requestError instanceof Error
        ? requestError.message
        : "Unable to contact the booking completion service."
    );
    return;
  }

  const result = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    setIsError(true);
    setMessage(
      result?.error ||
        "Eligible bookings could not be completed."
    );
    return;
  }

  if (result.followUpRequired) {
    setIsError(true);
    setMessage(
      result.message ||
        "Bookings were completed, but one or more Google Calendar events could not be updated."
    );
    return;
  }

  if (result.completed > 0) {
    setIsError(false);
    setMessage(
      result.message ||
        `${result.completed} booking(s) completed successfully.`
    );
  }
}

  const pendingBookings = bookings.filter(
    (booking) => booking.status === "Pending"
  );

  const depositPendingBookings = bookings.filter(
    (booking) => booking.status === "Deposit Pending"
  );

  const balancePendingBookings = bookings.filter(
    (booking) => booking.status === "Balance Pending"
  );

  const balancePaidBookings = bookings.filter(
    (booking) => booking.status === "Balance Paid"
  );

  const completedBookings = bookings.filter(
    (booking) => booking.status === "Completed"
  );

  const cancelledBookings = bookings.filter(
    (booking) => booking.status === "Cancelled"
  );

  const filteredBookings =
    selectedFilter === "All"
      ? bookings
      : bookings.filter((booking) => booking.status === selectedFilter);

  if (loading) {
    return <LoadingScreen message="Loading admin bookings..." />;
  }

  return (
    <AdminPageLayout>
      <PageCard
        title="Admin Bookings"
        subtitle="Review, confirm and manage customer booking requests."
      >
        {message && (
          <MessageBox type={isError ? "error" : "info"}>
            {message}
          </MessageBox>
        )}

        <BookingStatusSummary
          pendingCount={pendingBookings.length}
          confirmedCount={depositPendingBookings.length}
          depositReceivedCount={balancePendingBookings.length}
          balancePaidCount={balancePaidBookings.length}
          completedCount={completedBookings.length}
          cancelledCount={cancelledBookings.length}
        />

        <BookingStatusFilters
          selectedFilter={selectedFilter}
          onFilterChange={setSelectedFilter}
        />

        <div className="mt-6 md:mt-10">
          <h2 className="text-xl md:text-2xl font-semibold text-[#5C4033] mb-4 md:mb-6">
            {selectedFilter === "All"
              ? "All Bookings"
              : `${selectedFilter} Bookings`}
          </h2>

          {filteredBookings.length === 0 ? (
            <p className="text-sm md:text-base text-[#8B6A4E]">
              There are no bookings to show for this filter.
            </p>
          ) : (
            <div className="space-y-4 md:space-y-6">
            {filteredBookings.map((booking) => (
              <AdminBookingCard
                key={booking.id}
                booking={booking}
                onConfirm={confirmBooking}
                onCancel={cancelBooking}
                onMarkDepositPaid={markDepositPaid}
                onMarkBalancePaid={markBalancePaid}
              />
            ))}
            </div>
          )}
        </div>
      </PageCard>
    </AdminPageLayout>
  );
}