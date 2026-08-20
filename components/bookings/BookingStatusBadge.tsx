import {
  getBookingDisplayStatus,
  getBookingStatusStyle,
} from "@/lib/booking-status";

import type { Booking } from "@/types/booking";

type BookingStatusBadgeProps = {
  booking: Booking;
};

export default function BookingStatusBadge({
  booking,
}: BookingStatusBadgeProps) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-lg border px-3 py-1.5 text-xs font-semibold md:px-4 md:py-2 md:text-base ${getBookingStatusStyle(
        booking.status,
      )}`}
    >
      {getBookingDisplayStatus(booking)}
    </span>
  );
}
