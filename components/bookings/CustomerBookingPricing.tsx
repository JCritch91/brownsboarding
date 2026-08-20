import { formatDisplayDate, formatMoney } from "@/lib/helpers";

import type { Booking } from "@/types/booking";

type CustomerBookingPricingProps = {
  booking: Booking;
};

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

export default function CustomerBookingPricing({
  booking,
}: CustomerBookingPricingProps) {
  if (booking.total_cost === null) {
    return (
      <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 md:mt-4 md:p-4">
        <p className="text-sm font-medium text-amber-800 md:text-base">
          Price will be confirmed once Browns Boarding reviews your booking.
        </p>
      </div>
    );
  }

  const hasDeposit =
    booking.deposit_amount !== null && booking.deposit_amount > 0;

  return (
    <>
      <div className="mt-3 rounded-lg border border-[#D9CBB8] bg-[#F5EFE6] p-3 md:mt-4 md:p-4">
        <p className="text-sm font-semibold text-[#5C4033] md:text-base">
          Booking Cost
        </p>

        <p className="mt-1 text-sm text-[#8B6A4E] md:mt-2 md:text-base">
          Total stay cost: {formatMoney(booking.total_cost)}
        </p>

        {booking.status === "Deposit Pending" && (
          <>
            <p className="text-sm text-[#8B6A4E] md:text-base">
              Deposit due now: {formatMoney(booking.deposit_amount || 0)}
            </p>

            <p className="text-sm text-[#8B6A4E] md:text-base">
              Remaining balance after deposit:{" "}
              {formatMoney(booking.balance_amount || 0)}
            </p>
          </>
        )}

        {booking.status === "Balance Pending" && (
          <>
            {hasDeposit ? (
              <>
                <p className="text-sm text-[#8B6A4E] md:text-base">
                  Deposit received: {formatMoney(booking.deposit_amount || 0)}
                </p>

                <p className="text-sm text-[#8B6A4E] md:text-base">
                  Remaining balance {getBalanceDueText(booking.start_date)}:{" "}
                  {formatMoney(booking.balance_amount || 0)}
                </p>
              </>
            ) : (
              <p className="text-sm text-[#8B6A4E] md:text-base">
                Full balance due now: {formatMoney(booking.balance_amount || 0)}
              </p>
            )}
          </>
        )}

        {booking.status === "Balance Paid" && (
          <>
            <p className="text-sm text-[#8B6A4E] md:text-base">
              Deposit received: {formatMoney(booking.deposit_amount || 0)}
            </p>

            <p className="text-sm text-[#8B6A4E] md:text-base">
              Remaining balance paid: {formatMoney(booking.balance_amount || 0)}
            </p>

            <p className="text-sm font-medium text-green-700 md:text-base">
              Remaining balance due: £0.00
            </p>
          </>
        )}

        {booking.status === "Completed" && (
          <>
            <p className="text-sm text-[#8B6A4E] md:text-base">
              Deposit received: {formatMoney(booking.deposit_amount || 0)}
            </p>

            <p className="text-sm text-[#8B6A4E] md:text-base">
              Remaining balance paid: {formatMoney(booking.balance_amount || 0)}
            </p>

            <p className="text-sm font-medium text-green-700 md:text-base">
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

      {booking.status !== "Pending" && booking.status !== "Cancelled" && (
        <div className="mt-3 space-y-1.5 md:mt-4 md:space-y-2">
          {hasDeposit ? (
            booking.deposit_paid_at ? (
              <p className="text-sm font-medium text-green-700 md:text-base">
                Deposit received on {formatDisplayDate(booking.deposit_paid_at)}
              </p>
            ) : booking.status === "Balance Pending" ||
              booking.status === "Balance Paid" ||
              booking.status === "Completed" ? (
              <p className="text-sm font-medium text-green-700 md:text-base">
                Deposit received.
              </p>
            ) : (
              <p className="text-sm font-medium text-amber-700 md:text-base">
                Deposit payment is still required.
              </p>
            )
          ) : null}

          {booking.balance_paid_at ? (
            <p className="text-sm font-medium text-green-700 md:text-base">
              Balance received on {formatDisplayDate(booking.balance_paid_at)}
            </p>
          ) : booking.status === "Balance Pending" ? (
            <p className="text-sm font-medium text-amber-700 md:text-base">
              {hasDeposit
                ? `Remaining balance is ${getBalanceDueText(
                    booking.start_date,
                  )}.`
                : "Full balance is due now."}
            </p>
          ) : booking.status === "Balance Paid" ||
            booking.status === "Completed" ? (
            <p className="text-sm font-medium text-green-700 md:text-base">
              Full balance paid.
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
