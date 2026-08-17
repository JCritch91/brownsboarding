"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/appActions";
import MessageBox from "@/components/MessageBox";
import LoadingScreen from "@/components/LoadingScreen";
import CustomerPageLayout from "@/components/CustomerPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import {
  authenticatedApiRequest,
} from "@/lib/client/authenticated-api";
import type {
  Booking,
} from "@/types/booking";
import BookingStatusBadge from "@/components/bookings/BookingStatusBadge";

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
  `
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
  function formatDisplayDate(dateString: string) {
    if (!dateString) return "";

    const [year, month, day] = dateString.split("-");

    return `${day}/${month}/${year}`;
  }


function getBalanceDueText(startDate: string) {
  const [year, month, day] = startDate.split("-").map(Number);

  const dueDate = new Date(year, month - 1, day);
  dueDate.setDate(dueDate.getDate() - 14);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  dueDate.setHours(0, 0, 0, 0);

  if (dueDate <= today) {
    return "due now";
  }

  const dueDay = String(dueDate.getDate()).padStart(2, "0");
  const dueMonth = String(dueDate.getMonth() + 1).padStart(2, "0");
  const dueYear = dueDate.getFullYear();

  return `due by ${dueDay}/${dueMonth}/${dueYear}`;
}

  function toTitleCase(text: string | null | undefined) {
  if (!text) return "";

  return text
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

  function isUpcomingOrCurrent(booking: Booking) {
    const today = new Date().toISOString().split("T")[0];

    return booking.end_date >= today && booking.status !== "Cancelled";
  }

  function isHistoric(booking: Booking) {
    const today = new Date().toISOString().split("T")[0];

    return booking.end_date < today || booking.status === "Cancelled";
  }

  function formatMoney(amount: number | null) {
  if (amount === null || amount === undefined) return "";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

async function cancelBooking(
  booking: Booking
) {
  const confirmed = window.confirm(
    `Are you sure you want to cancel booking ${booking.booking_reference}?\n\n${
      booking.status === "Pending"
        ? "This booking request has not yet reduced availability."
        : "The reserved availability will be restored."
    }`
  );

  if (!confirmed) {
    return;
  }

  setMessage("");
  setIsError(false);

  const result =
    await authenticatedApiRequest<BookingCancellationResponse>(
      "/api/bookings/cancel",
      {
        body: {
          bookingId: booking.id,
        },
      }
    );

  if (result.unauthenticated) {
    window.location.href = "/login";
    return;
  }

  if (!result.ok) {
    setIsError(true);
    setMessage(
      result.error ||
        "The booking could not be cancelled."
    );

    await loadBookings();
    return;
  }

  if (
    !result.data ||
    !result.data.databaseCancelled
  ) {
    setIsError(true);
    setMessage(
      result.data?.error ||
        "The cancellation service did not cancel the booking."
    );

    await loadBookings();
    return;
  }

  if (result.data.followUpRequired) {
    setIsError(true);
    setMessage(
      result.data.message ||
        "The booking was cancelled, but one or more calendar or email operations could not be completed."
    );

    await loadBookings();
    return;
  }

  setIsError(false);
  setMessage(
    result.data.message ||
      "Your booking has been cancelled successfully."
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
      actions={
        <Button href="/bookings">
          Make a Booking
        </Button>
      }
    >
      {message && (
        <MessageBox
          type={isError ? "error" : "info"}
        >
          {message}
        </MessageBox>
      )}

      {bookings.length === 0 ? (
        <div className="text-center py-8 md:py-12">
          <p className="text-sm md:text-lg text-[#8B6A4E]">
            You do not have any bookings yet.
          </p>

          <div className="mt-4 md:mt-6 flex justify-center">
            <Button href="/bookings">
              Make a Booking
            </Button>
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
                  <div
                    key={booking.id}
                    className="bg-white border border-[#D9CBB8] rounded-xl p-4 md:p-6 shadow"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4">
                      <div>
                        <h3 className="text-xl md:text-2xl font-semibold text-[#5C4033]">
                          {toTitleCase(booking.dogs?.name) || "Dog"}
                        </h3>

                        <p className="mt-1 text-xs font-semibold text-[#8B6A4E] md:text-sm">
                          Booking reference: {booking.booking_reference}
                        </p>

                        {booking.dogs?.breed && (
                          <p className="mt-1 text-sm md:text-base text-[#8B6A4E]">
                            {toTitleCase(booking.dogs.breed)}
                          </p>
                        )}

                        <p className="mt-2 md:mt-3 text-sm md:text-base text-[#5C4033] font-medium">
                          Stay dates: {formatDisplayDate(booking.start_date)} →{" "}
                          {formatDisplayDate(booking.end_date)}
                        </p>

                        {booking.total_cost !== null ? (
                          <div className="mt-3 md:mt-4 bg-[#F5EFE6] border border-[#D9CBB8] p-3 md:p-4 rounded-lg">
                            <p className="text-sm md:text-base text-[#5C4033] font-semibold">
                              Booking Cost
                            </p>

                            <p className="mt-1 md:mt-2 text-sm md:text-base text-[#8B6A4E]">
                              Total stay cost: {formatMoney(booking.total_cost)}
                            </p>

                            {booking.status === "Deposit Pending" && (
                              <>
                                <p className="text-sm md:text-base text-[#8B6A4E]">
                                  Deposit due now:{" "}
                                  {formatMoney(booking.deposit_amount)}
                                </p>

                                <p className="text-sm md:text-base text-[#8B6A4E]">
                                  Remaining balance after deposit:{" "}
                                  {formatMoney(booking.balance_amount)}
                                </p>
                              </>
                            )}

                            {booking.status === "Balance Pending" && (
                              <>
                                {booking.deposit_amount !== null &&
                                  booking.deposit_amount > 0? (
                                  <>
                                    <p className="text-sm md:text-base text-[#8B6A4E]">
                                      Deposit received:{" "}
                                      {formatMoney(booking.deposit_amount)}
                                    </p>

                                    <p className="text-sm md:text-base text-[#8B6A4E]">
                                      Remaining balance{" "}
                                      {getBalanceDueText(booking.start_date)}:{" "}
                                      {formatMoney(booking.balance_amount)}
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-sm md:text-base text-[#8B6A4E]">
                                    Full balance due now:{" "}
                                    {formatMoney(booking.balance_amount)}
                                  </p>
                                )}
                              </>
                            )}

                            {booking.status === "Balance Paid" && (
                              <>
                                <p className="text-sm md:text-base text-[#8B6A4E]">
                                  Deposit received:{" "}
                                  {formatMoney(booking.deposit_amount)}
                                </p>

                                <p className="text-sm md:text-base text-[#8B6A4E]">
                                  Remaining balance paid:{" "}
                                  {formatMoney(booking.balance_amount)}
                                </p>

                                <p className="text-sm md:text-base text-green-700 font-medium">
                                  Remaining balance due: £0.00
                                </p>
                              </>
                            )}

                            {booking.status === "Completed" && (
                              <>
                                <p className="text-sm md:text-base text-[#8B6A4E]">
                                  Deposit received:{" "}
                                  {formatMoney(booking.deposit_amount)}
                                </p>

                                <p className="text-sm md:text-base text-[#8B6A4E]">
                                  Remaining balance paid:{" "}
                                  {formatMoney(booking.balance_amount)}
                                </p>

                                <p className="text-sm md:text-base text-green-700 font-medium">
                                  Fully paid.
                                </p>
                              </>
                            )}

                            {booking.number_of_nights !== null &&
                              booking.number_of_nights > 0 &&
                              booking.nightly_rate !== null && (
                                <p className="mt-2 text-sm text-[#8B6A4E]">
                                  Based on {booking.number_of_nights} night
                                  {booking.number_of_nights === 1 ? "" : "s"} at{" "}
                                  {formatMoney(booking.nightly_rate)} per night.
                                </p>
                              )}
                          </div>
                        ) : (
                          <div className="mt-3 md:mt-4 bg-amber-50 border border-amber-300 p-3 md:p-4 rounded-lg">
                            <p className="text-sm md:text-base text-amber-800 font-medium">
                              Price will be confirmed once Browns Boarding
                              reviews your booking.
                            </p>
                          </div>
                        )}

                        {booking.status !== "Pending" &&
                          booking.status !== "Cancelled" && (
                            <div className="mt-3 md:mt-4 space-y-1.5 md:space-y-2">
                              {booking.deposit_amount !== null &&
                                booking.deposit_amount > 0?(
                                booking.deposit_paid_at ? (
                                  <p className="text-sm md:text-base text-green-700 font-medium">
                                    Deposit received on{" "}
                                    {formatDisplayDate(
                                      booking.deposit_paid_at
                                    )}
                                  </p>
                                ) : booking.status === "Balance Pending" ||
                                  booking.status === "Balance Paid" ? (
                                  <p className="text-sm md:text-base text-green-700 font-medium">
                                    Deposit received.
                                  </p>
                                ) : (
                                  <p className="text-sm md:text-base text-amber-700 font-medium">
                                    Deposit payment is still required.
                                  </p>
                                )
                              ) : null}

                              {booking.balance_paid_at ? (
                                <p className="text-sm md:text-base text-green-700 font-medium">
                                  Balance received on{" "}
                                  {formatDisplayDate(booking.balance_paid_at)}
                                </p>
                              ) : booking.status === "Balance Pending" ? (
                                <p className="text-sm md:text-base text-amber-700 font-medium">
                                  {booking.deposit_amount && booking.deposit_amount > 0
                                    ? `Remaining balance is ${getBalanceDueText(
                                        booking.start_date
                                      )}.`
                                    : "Full balance is due now."}
                                </p>
                              ) : booking.status === "Balance Paid" ? (
                                <p className="text-sm md:text-base text-green-700 font-medium">
                                  Full balance paid.
                                </p>
                              ) : null}
                            </div>
                          )}

                        {booking.notes && (
                          <p className="mt-2 md:mt-3 text-sm md:text-base text-[#8B6A4E]">
                            Notes: {booking.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap md:flex-col gap-2 md:gap-3 md:items-end">
                        <BookingStatusBadge booking={booking} />

                        {[
                          "Pending",
                          "Deposit Pending",
                          "Balance Pending",
                          "Balance Paid",
                        ].includes(booking.status) && (
                          <button
                            type="button"
                            onClick={() => cancelBooking(booking)}
                            className="inline-flex w-fit items-center justify-center border border-red-400 text-red-600 px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-base rounded-lg font-semibold hover:bg-red-50 hover:scale-105 transition-all duration-300 cursor-pointer"                          >
                            Cancel Booking
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
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
                  <div
                    key={booking.id}
                    className="bg-white border border-[#D9CBB8] rounded-xl p-4 md:p-6 shadow"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4">
                      <div>
                        <h3 className="text-xl md:text-2xl font-semibold text-[#5C4033]">
                          {toTitleCase(booking.dogs?.name) || "Dog"}
                        </h3>

                        <p className="mt-1 text-xs font-semibold text-[#8B6A4E] md:text-sm">
                          Booking reference: {booking.booking_reference}
                        </p>

                        {booking.dogs?.breed && (
                          <p className="mt-1 text-sm md:text-base text-[#8B6A4E]">
                            {toTitleCase(booking.dogs.breed)}
                          </p>
                        )}

                        <p className="mt-2 md:mt-3 text-sm md:text-base text-[#5C4033] font-medium">
                          Stay dates: {formatDisplayDate(booking.start_date)} →{" "}
                          {formatDisplayDate(booking.end_date)}
                        </p>

                        {booking.notes && (
                          <p className="mt-2 md:mt-3 text-sm md:text-base text-[#8B6A4E]">
                            Notes: {booking.notes}
                          </p>
                        )}
                      </div>

                      <BookingStatusBadge booking={booking} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </PageCard>
  </CustomerPageLayout>
);
}