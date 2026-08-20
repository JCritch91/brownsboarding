import Button from "@/components/Buttons";
import BookingStatusBadge from "@/components/bookings/BookingStatusBadge";

import type { BookingWithCustomer } from "@/types/booking";

type AdminBookingActionsProps = {
  booking: BookingWithCustomer;

  onConfirm: (booking: BookingWithCustomer) => void | Promise<void>;

  onCancel: (booking: BookingWithCustomer) => void | Promise<void>;

  onMarkDepositPaid: (booking: BookingWithCustomer) => void | Promise<void>;

  onMarkBalancePaid: (booking: BookingWithCustomer) => void | Promise<void>;
};

export default function AdminBookingActions({
  booking,
  onConfirm,
  onCancel,
  onMarkDepositPaid,
  onMarkBalancePaid,
}: AdminBookingActionsProps) {
  return (
    <div className="flex flex-wrap gap-2 pt-1 md:flex-col md:items-end md:gap-3">
      <BookingStatusBadge booking={booking} />

      {booking.status === "Pending" && (
        <div className="flex flex-wrap gap-2 md:flex-col md:items-end">
          <Button
            type="button"
            variant="dark"
            onClick={() => onConfirm(booking)}
          >
            Confirm Booking
          </Button>

          <button
            type="button"
            onClick={() => onCancel(booking)}
            className="inline-flex w-fit cursor-pointer items-center justify-center rounded-lg border border-red-400 px-3 py-1.5 text-xs font-semibold text-red-600 transition-all duration-300 hover:scale-105 hover:bg-red-50 md:px-4 md:py-2 md:text-base"
          >
            Cancel Booking
          </button>
        </div>
      )}

      {booking.status === "Deposit Pending" && (
        <div className="flex flex-wrap gap-2 md:flex-col md:items-end">
          <button
            type="button"
            onClick={() => onMarkDepositPaid(booking)}
            className="inline-flex w-fit cursor-pointer items-center justify-center rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition-all duration-300 hover:scale-105 hover:bg-green-700 md:px-4 md:py-2 md:text-base"
          >
            Mark Deposit Paid
          </button>

          <button
            type="button"
            onClick={() => onCancel(booking)}
            className="inline-flex w-fit cursor-pointer items-center justify-center rounded-lg border border-red-400 px-3 py-1.5 text-xs font-semibold text-red-600 transition-all duration-300 hover:scale-105 hover:bg-red-50 md:px-4 md:py-2 md:text-base"
          >
            Cancel Booking
          </button>
        </div>
      )}

      {booking.status === "Balance Pending" && (
        <div className="flex flex-wrap gap-2 md:flex-col md:items-end">
          <p className="w-full text-xs font-medium text-amber-700 md:max-w-xs md:text-right md:text-sm">
            {booking.deposit_amount !== null && booking.deposit_amount > 0
              ? "Deposit received. Awaiting remaining balance."
              : "Full balance due. No deposit required."}
          </p>

          <button
            type="button"
            onClick={() => onMarkBalancePaid(booking)}
            className="inline-flex w-fit cursor-pointer items-center justify-center rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition-all duration-300 hover:scale-105 hover:bg-green-700 md:px-4 md:py-2 md:text-base"
          >
            Mark Balance Paid
          </button>

          <button
            type="button"
            onClick={() => onCancel(booking)}
            className="inline-flex w-fit cursor-pointer items-center justify-center rounded-lg border border-red-400 px-3 py-1.5 text-xs font-semibold text-red-600 transition-all duration-300 hover:scale-105 hover:bg-red-50 md:px-4 md:py-2 md:text-base"
          >
            Cancel Booking
          </button>
        </div>
      )}

      {booking.status === "Balance Paid" && (
        <div className="flex flex-wrap gap-2 md:flex-col md:items-end">
          <p className="text-xs font-medium text-[#8B6A4E] md:text-right md:text-sm">
            Awaiting stay completion.
          </p>

          <button
            type="button"
            onClick={() => onCancel(booking)}
            className="inline-flex w-fit cursor-pointer items-center justify-center rounded-lg border border-red-400 px-3 py-1.5 text-xs font-semibold text-red-600 transition-all duration-300 hover:scale-105 hover:bg-red-50 md:px-4 md:py-2 md:text-base"
          >
            Cancel Booking
          </button>
        </div>
      )}

      {booking.status === "Completed" && (
        <p className="text-xs font-medium text-blue-700 md:text-right md:text-sm">
          Booking completed.
        </p>
      )}

      {booking.status === "Cancelled" && (
        <p className="text-xs font-medium text-red-700 md:text-right md:text-sm">
          No further actions are available.
        </p>
      )}
    </div>
  );
}
