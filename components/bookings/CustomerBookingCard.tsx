import { formatDisplayDate, formatName } from "@/lib/helpers";

import BookingStatusBadge from "@/components/bookings/BookingStatusBadge";
import CustomerBookingPricing from "@/components/bookings/CustomerBookingPricing";

import { CANCELLABLE_BOOKING_STATUSES, type Booking } from "@/types/booking";

type CustomerBookingCardProps = {
  booking: Booking;
  variant: "upcoming" | "historic";

  onCancel?: (booking: Booking) => void | Promise<void>;
};

export default function CustomerBookingCard({
  booking,
  variant,
  onCancel,
}: CustomerBookingCardProps) {
  const isUpcoming = variant === "upcoming";

  const canCancel =
    isUpcoming &&
    CANCELLABLE_BOOKING_STATUSES.includes(booking.status) &&
    Boolean(onCancel);

  return (
    <div className="rounded-xl border border-[#D9CBB8] bg-white p-4 shadow md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div>
          <h3 className="text-xl font-semibold text-[#5C4033] md:text-2xl">
            {formatName(booking.dogs?.name || "") || "Dog"}
          </h3>

          <p className="mt-1 text-xs font-semibold text-[#8B6A4E] md:text-sm">
            Booking reference: {booking.booking_reference}
          </p>

          {booking.dogs?.breed && (
            <p className="mt-1 text-sm text-[#8B6A4E] md:text-base">
              {formatName(booking.dogs.breed)}
            </p>
          )}

          <p className="mt-2 text-sm font-medium text-[#5C4033] md:mt-3 md:text-base">
            Stay dates: {formatDisplayDate(booking.start_date)} →{" "}
            {formatDisplayDate(booking.end_date)}
          </p>

          {isUpcoming && <CustomerBookingPricing booking={booking} />}

          {booking.notes && (
            <p className="mt-2 text-sm text-[#8B6A4E] md:mt-3 md:text-base">
              Notes: {booking.notes}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 md:flex-col md:items-end md:gap-3">
          <BookingStatusBadge booking={booking} />

          {canCancel && onCancel && (
            <button
              type="button"
              onClick={() => onCancel(booking)}
              className="inline-flex w-fit cursor-pointer items-center justify-center rounded-lg border border-red-400 px-3 py-1.5 text-xs font-semibold text-red-600 transition-all duration-300 hover:scale-105 hover:bg-red-50 md:px-4 md:py-2 md:text-base"
            >
              Cancel Booking
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
