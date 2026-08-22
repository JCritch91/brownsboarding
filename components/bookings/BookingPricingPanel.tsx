import { formatMoney } from "@/lib/helpers";
import {
  getBookingTypeLabel,
  getDaycareSessionLabel,
  type BookingWithCustomer,
} from "@/types/booking";

type BookingPricingPanelProps = {
  booking: BookingWithCustomer;
};

function getPricingDescription(booking: BookingWithCustomer) {
  if (
    booking.price_unit === "boarding_night" &&
    booking.quantity !== null &&
    booking.unit_rate !== null
  ) {
    return `Based on ${booking.quantity} night${
      booking.quantity === 1 ? "" : "s"
    } at ${formatMoney(booking.unit_rate)} per night.`;
  }

  if (booking.price_unit === "daycare_full_day" && booking.unit_rate !== null) {
    return `Full Day Doggy Day Care at ${formatMoney(booking.unit_rate)}.`;
  }

  if (booking.price_unit === "daycare_half_day" && booking.unit_rate !== null) {
    return `Half Day Doggy Day Care at ${formatMoney(booking.unit_rate)}.`;
  }

  if (
    booking.number_of_nights !== null &&
    booking.number_of_nights > 0 &&
    booking.nightly_rate !== null
  ) {
    return `Based on ${booking.number_of_nights} night${
      booking.number_of_nights === 1 ? "" : "s"
    } at ${formatMoney(booking.nightly_rate)} per night.`;
  }

  return null;
}

export default function BookingPricingPanel({
  booking,
}: BookingPricingPanelProps) {
  if (booking.total_cost === null) {
    return null;
  }

  const pricingDescription = getPricingDescription(booking);

  return (
    <div className="mt-3 rounded-lg border border-[#D9CBB8] bg-[#F5EFE6] p-3 md:mt-4 md:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-[#5C4033] md:text-base">
          Booking Cost
        </p>

        <span className="inline-flex w-fit rounded-lg border border-[#D9CBB8] bg-white px-2.5 py-1 text-xs font-semibold text-[#8B6A4E]">
          {getBookingTypeLabel(booking.booking_type)}
          {booking.booking_type === "daycare" && booking.daycare_session
            ? `, ${getDaycareSessionLabel(booking.daycare_session)}`
            : ""}
        </span>
      </div>

      <p className="mt-2 text-sm text-[#8B6A4E] md:text-base">
        Total: {formatMoney(booking.total_cost)}
      </p>

      {booking.deposit_amount !== null && (
        <p className="text-sm text-[#8B6A4E] md:text-base">
          Deposit: {formatMoney(booking.deposit_amount)}
        </p>
      )}

      {booking.balance_amount !== null && (
        <p className="text-sm text-[#8B6A4E] md:text-base">
          Balance: {formatMoney(booking.balance_amount)}
        </p>
      )}

      {pricingDescription && (
        <p className="mt-2 text-xs text-[#8B6A4E] md:text-sm">
          {pricingDescription}
        </p>
      )}
    </div>
  );
}
