import { formatMoney } from "@/lib/helpers";

import type {
  BookingWithCustomer,
} from "@/types/booking";

type BookingPricingPanelProps = {
  booking: BookingWithCustomer;
};

export default function BookingPricingPanel({
  booking,
}: BookingPricingPanelProps) {
  if (booking.total_cost === null) {
    return null;
  }

  return (
    <div className="mt-3 rounded-lg border border-[#D9CBB8] bg-[#F5EFE6] p-3 md:mt-4 md:p-4">
      <p className="text-sm font-semibold text-[#5C4033] md:text-base">
        Booking Cost
      </p>

      <p className="mt-1 text-sm text-[#8B6A4E] md:mt-2 md:text-base">
        Total: {formatMoney(booking.total_cost)}
      </p>

      {booking.deposit_amount !== null && (
        <p className="text-sm text-[#8B6A4E] md:text-base">
          Deposit:{" "}
          {formatMoney(booking.deposit_amount)}
        </p>
      )}

      {booking.balance_amount !== null && (
        <p className="text-sm text-[#8B6A4E] md:text-base">
          Balance:{" "}
          {formatMoney(booking.balance_amount)}
        </p>
      )}

      {booking.number_of_nights !== null &&
        booking.number_of_nights > 0 &&
        booking.nightly_rate !== null && (
          <p className="mt-2 text-xs text-[#8B6A4E] md:text-sm">
            Based on {booking.number_of_nights} night
            {booking.number_of_nights === 1
              ? ""
              : "s"}{" "}
            at {formatMoney(booking.nightly_rate)} per
            night.
          </p>
        )}
    </div>
  );
}