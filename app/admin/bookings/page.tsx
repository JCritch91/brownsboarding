"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ensureActiveAdminUser } from "@/lib/appActions";
import AdminPageLayout from "@/components/AdminPageLayout";
import PageCard from "@/components/PageCard";
import MessageBox from "@/components/MessageBox";
import LoadingScreen from "@/components/LoadingScreen";
import {
  formatDisplayDate,
  formatMoney,
  formatName,
  getTodayForDateInput,
  isWithinTwoWeeks,
} from "@/lib/helpers";
import type {
  Booking,
  BookingCustomerSummary,
  BookingFilter,
  BookingStatus,
  BookingWithCustomer,
} from "@/types/booking";
import AdminBookingCard from "@/components/bookings/AdminBookingCard";
import BookingStatusSummary from "@/components/bookings/BookingStatusSummary";
import BookingStatusFilters from "@/components/bookings/BookingStatusFilters";
import { authenticatedApiRequest } from "@/lib/client/authenticated-api";
import ConfirmationModal from "@/components/modals/ConfirmationModal";

type BookingPaymentResponse = {
  success: boolean;
  paymentRecorded: boolean;
  followUpRequired: boolean;
  message?: string;
  error?: string;
};

type BookingAvailabilityConfirmationResponse = {
  success: boolean;
  availabilityConfirmed: boolean;
  alreadyConfirmed: boolean;
  createdAvailabilityDates: number;
  message?: string;
  error?: string;
};

type BookingConfirmationResponse = {
  success: boolean;
  databaseConfirmed: boolean;
  followUpRequired: boolean;
  message?: string;
  error?: string;
};

type BookingCancellationResponse = {
  success: boolean;
  databaseCancelled: boolean;
  followUpRequired: boolean;
  message?: string;
  error?: string;
};

type BookingCompletionResponse = {
  success: boolean;
  databaseCompleted?: boolean;
  processed: number;
  completed: number;
  calendarUpdated: number;
  followUpRequired: boolean;
  message?: string;
  error?: string;
};

type PaymentAction = {
  booking: BookingWithCustomer;
  paymentType: "Deposit" | "Balance";
};

export default function AdminBookingsPage() {
  const [loading, setLoading] = useState(true);

  const [bookings, setBookings] = useState<BookingWithCustomer[]>([]);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const [selectedFilter, setSelectedFilter] = useState<BookingFilter>("Live");

  const [bookingToCancel, setBookingToCancel] =
    useState<BookingWithCustomer | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState(false);
  const [bookingToConfirm, setBookingToConfirm] =
    useState<BookingWithCustomer | null>(null);
  const [confirmingBooking, setConfirmingBooking] = useState(false);

  const [bookingToConfirmAvailability, setBookingToConfirmAvailability] =
    useState<BookingWithCustomer | null>(null);

  const [confirmingAvailability, setConfirmingAvailability] = useState(false);

  const [paymentAction, setPaymentAction] = useState<PaymentAction | null>(
    null,
  );
  const [paymentDate, setPaymentDate] = useState("");
  const [recordingPayment, setRecordingPayment] = useState(false);

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
booking_type,
daycare_session,
start_date,
end_date,
status,
availability_confirmation_required,
availability_confirmed_at,
availability_confirmed_by,
space_units,
        notes,
        created_at,
pricing_setting_id,
price_unit,
unit_rate,
quantity,
deposit_percentage_applied,
nightly_rate,
number_of_nights,
total_cost,
deposit_amount,
balance_amount,
        deposit_paid_at,
        balance_paid_at,
dogs (
  id,
  name,
  breed,
  can_share_with_other_dogs
),
booking_dogs (
  id,
  booking_id,
  dog_id,
  sort_order,
  created_at,
  dogs (
    id,
    name,
    breed,
    can_share_with_other_dogs
  )
)
        `,
      )
      .order("start_date", { ascending: true });

    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }

    const bookingData = (data ?? []) as unknown as Booking[];

    const ownerIds = Array.from(
      new Set(bookingData.map((booking) => booking.owner_id)),
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
        (profile) => profile.id === booking.owner_id,
      );

      return {
        ...booking,
        customer: customer || null,
      };
    });

    setBookings(bookingsWithCustomers);
  }

  function requestAvailabilityConfirmation(booking: BookingWithCustomer) {
    if (confirmingAvailability) {
      return;
    }

    if (
      !booking.availability_confirmation_required ||
      booking.availability_confirmed_at
    ) {
      setIsError(true);
      setMessage("This booking does not require an availability review.");
      return;
    }

    setMessage("");
    setIsError(false);
    setBookingToConfirmAvailability(booking);
  }

  async function confirmSelectedBookingAvailability() {
    if (!bookingToConfirmAvailability || confirmingAvailability) {
      return;
    }

    const booking = bookingToConfirmAvailability;

    setConfirmingAvailability(true);
    setMessage("");
    setIsError(false);

    const result =
      await authenticatedApiRequest<BookingAvailabilityConfirmationResponse>(
        "/api/admin/bookings/confirm-availability",
        {
          body: {
            bookingId: booking.id,
          },
        },
      );

    if (result.unauthenticated) {
      setConfirmingAvailability(false);
      setBookingToConfirmAvailability(null);
      window.location.href = "/login";
      return;
    }

    if (!result.ok) {
      setConfirmingAvailability(false);
      setBookingToConfirmAvailability(null);
      setIsError(true);
      setMessage(
        result.error || "Availability could not be confirmed for this booking.",
      );
      await loadBookings();
      return;
    }

    if (!result.data || !result.data.availabilityConfirmed) {
      setConfirmingAvailability(false);
      setBookingToConfirmAvailability(null);
      setIsError(true);
      setMessage(
        result.data?.error ||
          "The availability service did not confirm the selected booking.",
      );
      await loadBookings();
      return;
    }

    setConfirmingAvailability(false);
    setBookingToConfirmAvailability(null);
    setIsError(false);
    setMessage(
      result.data.message || "Availability was confirmed successfully.",
    );

    await loadBookings();
  }

  function requestBookingConfirmation(booking: BookingWithCustomer) {
    if (confirmingBooking) {
      return;
    }

    if (
      booking.availability_confirmation_required &&
      !booking.availability_confirmed_at
    ) {
      setIsError(true);
      setMessage(
        "Availability must be reviewed before this booking can be confirmed.",
      );
      return;
    }

    setBookingToConfirm(booking);
  }

  async function confirmSelectedBooking() {
    if (!bookingToConfirm || confirmingBooking) {
      return;
    }

    const booking = bookingToConfirm;

    setConfirmingBooking(true);
    setMessage("");
    setIsError(false);

    const result = await authenticatedApiRequest<BookingConfirmationResponse>(
      "/api/admin/bookings/confirm",
      {
        body: {
          bookingId: booking.id,
        },
      },
    );

    if (result.unauthenticated) {
      setConfirmingBooking(false);
      setBookingToConfirm(null);
      window.location.href = "/login";
      return;
    }

    if (!result.ok) {
      setConfirmingBooking(false);
      setBookingToConfirm(null);
      setIsError(true);
      setMessage(result.error || "The booking could not be confirmed.");
      await loadBookings();
      return;
    }

    if (!result.data || !result.data.databaseConfirmed) {
      setConfirmingBooking(false);
      setBookingToConfirm(null);
      setIsError(true);
      setMessage(
        result.data?.error ||
          "The confirmation service did not confirm the booking.",
      );
      await loadBookings();
      return;
    }

    if (result.data.followUpRequired) {
      setConfirmingBooking(false);
      setBookingToConfirm(null);
      setIsError(true);
      setMessage(
        result.data.message ||
          "The booking was confirmed, but one or more calendar or email operations could not be completed.",
      );
      await loadBookings();
      return;
    }

    setConfirmingBooking(false);
    setBookingToConfirm(null);
    setIsError(false);
    setMessage(result.data.message || "Booking confirmed successfully.");
    await loadBookings();
  }

  function requestBookingCancellation(booking: BookingWithCustomer) {
    if (cancellingBooking) {
      return;
    }

    setBookingToCancel(booking);
  }

  async function confirmBookingCancellation() {
    if (!bookingToCancel || cancellingBooking) {
      return;
    }

    const booking = bookingToCancel;

    setCancellingBooking(true);
    setMessage("");
    setIsError(false);

    const result = await authenticatedApiRequest<BookingCancellationResponse>(
      "/api/bookings/cancel",
      {
        body: {
          bookingId: booking.id,
        },
      },
    );

    if (result.unauthenticated) {
      setCancellingBooking(false);
      setBookingToCancel(null);
      window.location.href = "/login";
      return;
    }

    if (!result.ok) {
      setCancellingBooking(false);
      setBookingToCancel(null);
      setIsError(true);
      setMessage(result.error || "The booking could not be cancelled.");
      await loadBookings();
      return;
    }

    if (!result.data || !result.data.databaseCancelled) {
      setCancellingBooking(false);
      setBookingToCancel(null);
      setIsError(true);
      setMessage(
        result.data?.error ||
          "The cancellation service did not cancel the booking.",
      );
      await loadBookings();
      return;
    }

    if (result.data.followUpRequired) {
      setCancellingBooking(false);
      setBookingToCancel(null);
      setIsError(true);
      setMessage(
        result.data.message ||
          "The booking was cancelled, but one or more calendar or email operations could not be completed.",
      );
      await loadBookings();
      return;
    }

    setCancellingBooking(false);
    setBookingToCancel(null);
    setIsError(false);
    setMessage(result.data.message || "Booking cancelled successfully.");
    await loadBookings();
  }

  async function recordBookingPayment(
    booking: BookingWithCustomer,
    paymentType: "Deposit" | "Balance",
    paymentDate: string,
  ) {
    const result = await authenticatedApiRequest<BookingPaymentResponse>(
      "/api/admin/bookings/record-payment",
      {
        body: {
          bookingId: booking.id,
          paymentType,
          paymentDate,
        },
      },
    );

    if (result.unauthenticated) {
      window.location.href = "/login";

      return false;
    }

    if (!result.ok) {
      setIsError(true);
      setMessage(
        result.error ||
          `The ${paymentType.toLowerCase()} payment could not be recorded.`,
      );

      await loadBookings();

      return false;
    }

    if (!result.data || !result.data.paymentRecorded) {
      setIsError(true);
      setMessage(
        result.data?.error ||
          `The payment service did not record the ${paymentType.toLowerCase()}.`,
      );

      await loadBookings();

      return false;
    }

    if (result.data.followUpRequired) {
      setIsError(true);
      setMessage(
        result.data.message ||
          `The ${paymentType.toLowerCase()} was recorded, but the calendar or receipt email could not be completed.`,
      );

      await loadBookings();

      return false;
    }

    setIsError(false);
    setMessage(
      result.data.message ||
        `The ${paymentType.toLowerCase()} was recorded successfully.`,
    );

    await loadBookings();

    return true;
  }

  function markDepositPaid(booking: BookingWithCustomer) {
    if (recordingPayment) {
      return;
    }

    if (booking.status !== "Deposit Pending") {
      setIsError(true);
      setMessage("This booking is no longer awaiting a deposit.");
      return;
    }

    setMessage("");
    setIsError(false);
    setPaymentDate(getTodayForDateInput());
    setPaymentAction({
      booking,
      paymentType: "Deposit",
    });
  }

  function markBalancePaid(booking: BookingWithCustomer) {
    if (recordingPayment) {
      return;
    }

    if (booking.status !== "Balance Pending") {
      setIsError(true);
      setMessage("This booking is no longer awaiting its balance.");
      return;
    }

    setMessage("");
    setIsError(false);
    setPaymentDate(getTodayForDateInput());
    setPaymentAction({
      booking,
      paymentType: "Balance",
    });
  }

  async function confirmPayment() {
    if (!paymentAction || recordingPayment) {
      return;
    }

    if (!paymentDate) {
      setIsError(true);
      setMessage("Please select the date the payment was received.");
      return;
    }

    const selectedPaymentDate = new Date(`${paymentDate}T00:00:00`);
    const today = new Date();

    selectedPaymentDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    if (
      Number.isNaN(selectedPaymentDate.getTime()) ||
      selectedPaymentDate > today
    ) {
      setIsError(true);
      setMessage(
        "The payment date must be a valid date and cannot be in the future.",
      );
      return;
    }

    const { booking, paymentType } = paymentAction;

    setRecordingPayment(true);
    setMessage("");
    setIsError(false);

    const paymentRecorded = await recordBookingPayment(
      booking,
      paymentType,
      paymentDate,
    );

    setRecordingPayment(false);

    if (!paymentRecorded) {
      return;
    }

    setPaymentAction(null);
    setPaymentDate("");
  }

  async function autoCompleteEligibleBookings() {
    const result = await authenticatedApiRequest<BookingCompletionResponse>(
      "/api/admin/bookings/complete",
    );

    if (result.unauthenticated) {
      window.location.href = "/login";
      return;
    }

    if (!result.ok) {
      setIsError(true);
      setMessage(result.error || "Eligible bookings could not be completed.");
      return;
    }

    if (!result.data) {
      setIsError(true);
      setMessage("The booking completion service returned no result.");
      return;
    }

    if (result.data.followUpRequired) {
      setIsError(true);
      setMessage(
        result.data.message ||
          "Bookings were completed, but one or more Google Calendar events could not be updated.",
      );
      return;
    }

    if (result.data.completed > 0) {
      setIsError(false);
      setMessage(
        result.data.message ||
          `${result.data.completed} booking(s) completed successfully.`,
      );
    }
  }

  const pendingBookings = bookings.filter(
    (booking) => booking.status === "Pending",
  );

  const depositPendingBookings = bookings.filter(
    (booking) => booking.status === "Deposit Pending",
  );

  const balancePendingBookings = bookings.filter(
    (booking) => booking.status === "Balance Pending",
  );

  const balancePaidBookings = bookings.filter(
    (booking) => booking.status === "Balance Paid",
  );

  const completedBookings = bookings.filter(
    (booking) => booking.status === "Completed",
  );

  const cancelledBookings = bookings.filter(
    (booking) => booking.status === "Cancelled",
  );

  const liveBookingStatuses: BookingStatus[] = [
    "Pending",
    "Deposit Pending",
    "Balance Pending",
    "Balance Paid",
  ];

  const filteredBookings =
    selectedFilter === "Live"
      ? bookings.filter((booking) =>
          liveBookingStatuses.includes(booking.status),
        )
      : selectedFilter === "All"
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
          <MessageBox type={isError ? "error" : "info"}>{message}</MessageBox>
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
                  onConfirmAvailability={requestAvailabilityConfirmation}
                  onConfirm={requestBookingConfirmation}
                  onCancel={requestBookingCancellation}
                  onMarkDepositPaid={markDepositPaid}
                  onMarkBalancePaid={markBalancePaid}
                />
              ))}
            </div>
          )}
        </div>
      </PageCard>

      <ConfirmationModal
        isOpen={bookingToConfirmAvailability !== null}
        title="Confirm Availability"
        confirmText="Confirm Availability"
        cancelText="Review Later"
        isConfirming={confirmingAvailability}
        variant="primary"
        onConfirm={confirmSelectedBookingAvailability}
        onCancel={() => {
          if (!confirmingAvailability) {
            setBookingToConfirmAvailability(null);
          }
        }}
      >
        {bookingToConfirmAvailability && (
          <div className="space-y-4">
            <p>
              Availability had not been configured for one or more dates when
              this booking request was submitted.
            </p>

            <dl className="grid gap-3 rounded-xl border border-[#D9CBB8] bg-[#FFFDF9] p-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-[#8B6A4E]">
                  Booking reference
                </dt>

                <dd className="mt-1 font-semibold text-[#5C4033]">
                  {bookingToConfirmAvailability.booking_reference}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-[#8B6A4E]">Dog</dt>

                <dd className="mt-1 font-semibold text-[#5C4033]">
                  {formatName(bookingToConfirmAvailability.dogs?.name || "Dog")}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-[#8B6A4E]">
                  Start date
                </dt>

                <dd className="mt-1 text-[#5C4033]">
                  {formatDisplayDate(bookingToConfirmAvailability.start_date)}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-[#8B6A4E]">
                  End date
                </dt>

                <dd className="mt-1 text-[#5C4033]">
                  {formatDisplayDate(bookingToConfirmAvailability.end_date)}
                </dd>
              </div>
            </dl>

            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800">
              <p className="font-semibold">Administrator review required</p>

              <p className="mt-1">
                Confirm only if Browns Boarding can accommodate this booking.
                Missing availability records will be created with one available
                space.
              </p>
            </div>

            <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 text-blue-800">
              <p>
                This action confirms availability only. The booking will remain
                Pending until the separate Confirm Booking action is completed.
              </p>
            </div>
          </div>
        )}
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={bookingToConfirm !== null}
        title="Confirm Booking"
        confirmText="Confirm Booking"
        cancelText="Review Later"
        isConfirming={confirmingBooking}
        variant="primary"
        onConfirm={confirmSelectedBooking}
        onCancel={() => {
          if (!confirmingBooking) {
            setBookingToConfirm(null);
          }
        }}
      >
        {bookingToConfirm && (
          <div className="space-y-4">
            <p>
              Please review the booking information before confirming the
              customer’s stay.
            </p>

            <dl className="grid gap-3 rounded-xl border border-[#D9CBB8] bg-[#FFFDF9] p-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-[#8B6A4E]">
                  Booking reference
                </dt>
                <dd className="mt-1 font-semibold text-[#5C4033]">
                  {bookingToConfirm.booking_reference}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-[#8B6A4E]">Dog</dt>
                <dd className="mt-1 font-semibold text-[#5C4033]">
                  {formatName(bookingToConfirm.dogs?.name || "Dog")}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-[#8B6A4E]">
                  Start date
                </dt>
                <dd className="mt-1 text-[#5C4033]">
                  {formatDisplayDate(bookingToConfirm.start_date)}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-[#8B6A4E]">
                  End date
                </dt>
                <dd className="mt-1 text-[#5C4033]">
                  {formatDisplayDate(bookingToConfirm.end_date)}
                </dd>
              </div>
            </dl>

            {isWithinTwoWeeks(bookingToConfirm.start_date) ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800">
                <p className="font-semibold">Short-notice booking</p>
                <p className="mt-1">
                  This booking starts within 14 days. The deposit stage will be
                  skipped and the booking will move directly to Balance Pending.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 text-blue-800">
                <p>
                  Confirming this booking will calculate the price, reduce
                  availability, update the configured Google calendars and send
                  the customer a confirmation email.
                </p>
              </div>
            )}
          </div>
        )}
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={bookingToCancel !== null}
        title="Cancel Booking"
        confirmText="Cancel Booking"
        cancelText="Keep Booking"
        isConfirming={cancellingBooking}
        variant="danger"
        onConfirm={confirmBookingCancellation}
        onCancel={() => {
          if (!cancellingBooking) {
            setBookingToCancel(null);
          }
        }}
      >
        {bookingToCancel && (
          <div className="space-y-4">
            <p>
              Please confirm that you want to cancel this booking. This action
              cannot be undone.
            </p>

            <dl className="grid gap-3 rounded-xl border border-[#D9CBB8] bg-[#FFFDF9] p-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-[#8B6A4E]">
                  Booking reference
                </dt>
                <dd className="mt-1 font-semibold text-[#5C4033]">
                  {bookingToCancel.booking_reference}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-[#8B6A4E]">Dog</dt>
                <dd className="mt-1 font-semibold text-[#5C4033]">
                  {formatName(bookingToCancel.dogs?.name || "Dog")}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-[#8B6A4E]">
                  Start date
                </dt>
                <dd className="mt-1 text-[#5C4033]">
                  {formatDisplayDate(bookingToCancel.start_date)}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-[#8B6A4E]">
                  End date
                </dt>
                <dd className="mt-1 text-[#5C4033]">
                  {formatDisplayDate(bookingToCancel.end_date)}
                </dd>
              </div>
            </dl>

            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-800">
              {bookingToCancel.status === "Pending" ? (
                <p>
                  This booking is still Pending, so availability has not been
                  reduced.
                </p>
              ) : (
                <p>
                  Availability will be restored for each occupied night. The
                  configured calendar and cancellation-email operations will
                  also be attempted.
                </p>
              )}
            </div>
          </div>
        )}
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={paymentAction !== null}
        title={
          paymentAction?.paymentType === "Deposit"
            ? "Record Deposit Payment"
            : "Record Balance Payment"
        }
        confirmText={
          paymentAction?.paymentType === "Deposit"
            ? "Record Deposit"
            : "Record Balance"
        }
        cancelText="Cancel"
        isConfirming={recordingPayment}
        variant="primary"
        onConfirm={confirmPayment}
        onCancel={() => {
          if (!recordingPayment) {
            setPaymentAction(null);
            setPaymentDate("");
          }
        }}
      >
        {paymentAction && (
          <div className="space-y-4">
            <p>Confirm the payment details before updating this booking.</p>

            <dl className="grid gap-3 rounded-xl border border-[#D9CBB8] bg-[#FFFDF9] p-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-[#8B6A4E]">
                  Booking reference
                </dt>
                <dd className="mt-1 font-semibold text-[#5C4033]">
                  {paymentAction.booking.booking_reference}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-[#8B6A4E]">Dog</dt>
                <dd className="mt-1 font-semibold text-[#5C4033]">
                  {formatName(paymentAction.booking.dogs?.name || "Dog")}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-[#8B6A4E]">
                  Payment type
                </dt>
                <dd className="mt-1 text-[#5C4033]">
                  {paymentAction.paymentType}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-[#8B6A4E]">Amount</dt>
                <dd className="mt-1 font-semibold text-[#5C4033]">
                  {formatMoney(
                    paymentAction.paymentType === "Deposit"
                      ? paymentAction.booking.deposit_amount || 0
                      : paymentAction.booking.balance_amount || 0,
                  )}
                </dd>
              </div>
            </dl>

            <div>
              <label
                htmlFor="paymentDate"
                className="mb-2 block text-sm font-medium text-[#5C4033]"
              >
                Date payment received
              </label>

              <input
                id="paymentDate"
                type="date"
                value={paymentDate}
                max={getTodayForDateInput()}
                onChange={(event) => {
                  setPaymentDate(event.target.value);
                  setMessage("");
                  setIsError(false);
                }}
                disabled={recordingPayment}
                className="min-h-11 w-full rounded-lg border border-[#D9CBB8] bg-white px-3 py-2 text-sm text-[#5C4033] outline-none transition-colors focus:border-[#8B6A4E] focus:ring-2 focus:ring-[#8B6A4E]/20 disabled:cursor-not-allowed disabled:opacity-60 md:text-base"
              />
            </div>

            <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 text-blue-800">
              {paymentAction.paymentType === "Deposit" ? (
                <p>
                  Recording the deposit will move the booking to Balance
                  Pending, create the payment record, update Google Calendar and
                  send the customer a deposit receipt.
                </p>
              ) : (
                <p>
                  Recording the balance will move the booking to Balance Paid,
                  create the payment record, update Google Calendar and send the
                  customer a balance receipt.
                </p>
              )}
            </div>
          </div>
        )}
      </ConfirmationModal>
    </AdminPageLayout>
  );
}
