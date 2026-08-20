import { formatDisplayDate, formatName } from "@/lib/helpers";

import AdminBookingActions from "@/components/bookings/AdminBookingActions";
import BookingPricingPanel from "@/components/bookings/BookingPricingPanel";

import type { BookingWithCustomer } from "@/types/booking";

type AdminBookingCardProps = {
  booking: BookingWithCustomer;

  onConfirm: (booking: BookingWithCustomer) => void | Promise<void>;

  onCancel: (booking: BookingWithCustomer) => void | Promise<void>;

  onMarkDepositPaid: (booking: BookingWithCustomer) => void | Promise<void>;

  onMarkBalancePaid: (booking: BookingWithCustomer) => void | Promise<void>;
};

function getCustomerName(booking: BookingWithCustomer) {
  const firstName = booking.customer?.first_name || "";

  const lastName = booking.customer?.last_name || "";

  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || booking.customer?.email || "Customer";
}

export default function AdminBookingCard({
  booking,
  onConfirm,
  onCancel,
  onMarkDepositPaid,
  onMarkBalancePaid,
}: AdminBookingCardProps) {
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

          <p className="mt-2 text-sm text-[#8B6A4E] md:mt-3 md:text-base">
            Customer: {getCustomerName(booking)}
          </p>

          {booking.customer?.email && (
            <p className="mt-1 break-all text-sm text-[#8B6A4E] md:text-base">
              Email: {booking.customer.email}
            </p>
          )}

          <BookingPricingPanel booking={booking} />

          {booking.notes && (
            <p className="mt-2 text-sm text-[#8B6A4E] md:mt-3 md:text-base">
              Notes: {booking.notes}
            </p>
          )}
        </div>

        <AdminBookingActions
          booking={booking}
          onConfirm={onConfirm}
          onCancel={onCancel}
          onMarkDepositPaid={onMarkDepositPaid}
          onMarkBalancePaid={onMarkBalancePaid}
        />
      </div>
    </div>
  );
}
