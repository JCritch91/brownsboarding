"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/appActions";
import MessageBox from "@/components/MessageBox";
import LoadingScreen from "@/components/LoadingScreen";
import CustomerPageLayout from "@/components/CustomerPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";

type Booking = {
  id: string;
  booking_reference: string;
  dog_id: string;
  start_date: string;
  end_date: string;
  status: string;
  notes: string | null;
  created_at: string;

  nightly_rate: number | null;
  number_of_nights: number | null;
  total_cost: number | null;
  deposit_amount: number | null;
  balance_amount: number | null;
  deposit_paid_at: string | null;
  balance_paid_at: string | null;

  dogs: {
    name: string;
    breed: string | null;
  } | null;
};

export default function MyBookingsPage() {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("");

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
        dog_id,
        start_date,
        end_date,
        status,
        notes,
        created_at,
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

function getDisplayStatus(status: string) {
  switch (status) {
    case "Pending":
      return "Pending review";

    case "Deposit Pending":
      return "Confirmed, deposit required";

    case "Balance Pending":
      return "Deposit received, balance pending";

    case "Balance Paid":
      return "Fully paid";

    case "Completed":
      return "Completed";

    case "Cancelled":
      return "Cancelled";

    default:
      return status;
  }
}

function getStatusStyle(status: string) {
  switch (status) {
    case "Pending":
      return "bg-amber-50 text-amber-800 border-amber-300";

    case "Deposit Pending":
      return "bg-green-50 text-green-800 border-green-300";

    case "Balance Pending":
      return "bg-blue-50 text-blue-800 border-blue-300";

    case "Balance Paid":
      return "bg-teal-50 text-teal-800 border-teal-300";

    case "Completed":
      return "bg-gray-50 text-gray-700 border-gray-300";

    case "Cancelled":
      return "bg-red-50 text-red-700 border-red-300";

    default:
      return "bg-gray-50 text-gray-700 border-gray-300";
  }
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

async function cancelBooking(booking: Booking) {
  const today = new Date();
  const arrival = new Date(`${booking.start_date}T00:00:00`);

  const daysUntilArrival = Math.ceil(
    (arrival.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  let confirmed = false;

  if (daysUntilArrival < 14) {
    confirmed = window.confirm(
      "This booking starts within 14 days.\n\nAs per the Browns Boarding cancellation policy, your deposit will be forfeited if you proceed.\n\nDo you still wish to cancel this booking?"
    );
  } else {
    confirmed = window.confirm(
      `Are you sure you want to cancel booking ${booking.booking_reference}?`
    );
  }

  if (!confirmed) return;

  setMessage("");

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    window.location.href = "/login";
    return;
  }

  const cancellationResponse = await fetch(
    "/api/bookings/cancel-booking",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bookingId: booking.id,
      }),
    }
  );

  const cancellationResult = await cancellationResponse
    .json()
    .catch(() => null);

  if (!cancellationResponse.ok) {
    setMessage(
      cancellationResult?.error ||
        "Unable to cancel the booking."
    );
    return;
  }

  setMessage(
    cancellationResult?.message ||
      "Booking cancelled successfully."
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
        <MessageBox type="info">
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

                        {booking.total_cost ? (
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
                                {booking.deposit_amount &&
                                booking.deposit_amount > 0 ? (
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

                            {booking.number_of_nights &&
                              booking.nightly_rate && (
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
                              {booking.deposit_amount &&
                              booking.deposit_amount > 0 ? (
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
                        <span
                          className={`inline-flex w-fit items-center border px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-base font-semibold ${getStatusStyle(
                            booking.status
                          )}`}
                        >
                          {getDisplayStatus(booking.status)}
                        </span>

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

                      <span
                        className={`inline-flex w-fit items-center border px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-base font-semibold ${getStatusStyle(
                          booking.status
                        )}`}
                      >
                        {getDisplayStatus(booking.status)}
                      </span>
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