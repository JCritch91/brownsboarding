"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/appActions";
import MessageBox from "@/components/MessageBox";
import LoadingScreen from "@/components/LoadingScreen";
import CustomerPageLayout from "@/components/CustomerPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import { authenticatedApiRequest } from "@/lib/client/authenticated-api";
import type { Booking } from "@/types/booking";
import CustomerBookingCard from "@/components/bookings/CustomerBookingCard";
import ConfirmationModal from "@/components/modals/ConfirmationModal";
import { formatDisplayDate, formatName } from "@/lib/helpers";

type BookingCancellationResponse = {
  success: boolean;
  databaseCancelled: boolean;
  followUpRequired: boolean;
  message?: string;
  error?: string;
};

export default function MyBookingsPage() {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState(false);

  useEffect(() => {
    loadBookings();
  }, []);

  async function loadBookings() {
    setLoading(true);
    setMessage("");

    let user;

    try {
      user = await getCurrentUser();
    } catch {
      window.location.href = "/login";
      return;
    }

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
  `,
      )

      .eq("owner_id", user.id)
      .order("start_date", { ascending: true });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setBookings((data ?? []) as unknown as Booking[]);
  }

  function isUpcomingOrCurrent(booking: Booking) {
    const today = new Date().toISOString().split("T")[0];

    return booking.end_date >= today && booking.status !== "Cancelled";
  }

  function isHistoric(booking: Booking) {
    const today = new Date().toISOString().split("T")[0];

    return booking.end_date < today || booking.status === "Cancelled";
  }

  function requestBookingCancellation(booking: Booking) {
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
      setMessage(result.error || "Your booking could not be cancelled.");
      await loadBookings();
      return;
    }

    if (!result.data || !result.data.databaseCancelled) {
      setCancellingBooking(false);
      setBookingToCancel(null);
      setIsError(true);
      setMessage(
        result.data?.error ||
          "The cancellation service did not cancel your booking.",
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
          "Your booking was cancelled, but one or more follow-up operations could not be completed.",
      );
      await loadBookings();
      return;
    }

    setCancellingBooking(false);
    setBookingToCancel(null);
    setIsError(false);
    setMessage(
      result.data.message || "Your booking was cancelled successfully.",
    );
    await loadBookings();
  }

  const upcomingBookings = bookings.filter(isUpcomingOrCurrent);
  const historicBookings = bookings.filter(isHistoric);

  if (loading) {
    return <LoadingScreen message="Loading your details..." />;
  }

  return (
    <CustomerPageLayout>
      <PageCard
        title="My Bookings"
        subtitle="View your current, upcoming and historic booking requests."
        actions={<Button href="/bookings">Make a Booking</Button>}
      >
        {message && (
          <MessageBox type={isError ? "error" : "info"}>{message}</MessageBox>
        )}

        {bookings.length === 0 ? (
          <div className="text-center py-8 md:py-12">
            <p className="text-sm md:text-lg text-[#8B6A4E]">
              You do not have any bookings yet.
            </p>

            <div className="mt-4 md:mt-6 flex justify-center">
              <Button href="/bookings">Make a Booking</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 md:space-y-12">
            {/* Upcoming Bookings */}
            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-[#5C4033] mb-4 md:mb-6">
                Current & Upcoming Bookings
              </h2>

              {upcomingBookings.length === 0 ? (
                <p className="text-sm md:text-base text-[#8B6A4E]">
                  You do not have any current or upcoming bookings.
                </p>
              ) : (
                <div className="space-y-4 md:space-y-6">
                  {upcomingBookings.map((booking) => (
                    <CustomerBookingCard
                      key={booking.id}
                      booking={booking}
                      variant="upcoming"
                      onCancel={requestBookingCancellation}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Historic Bookings */}
            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-[#5C4033] mb-4 md:mb-6">
                Historic Bookings
              </h2>

              {historicBookings.length === 0 ? (
                <p className="text-sm md:text-base text-[#8B6A4E]">
                  You do not have any historic bookings yet.
                </p>
              ) : (
                <div className="space-y-4 md:space-y-6">
                  {historicBookings.map((booking) => (
                    <CustomerBookingCard
                      key={booking.id}
                      booking={booking}
                      variant="historic"
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </PageCard>

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
              <p>
                Browns Boarding will be notified.
              </p>
            </div>
          </div>
        )}
      </ConfirmationModal>
    </CustomerPageLayout>
  );
}
