import type {
  Booking,
  BookingStatus,
} from "@/types/booking";

type BookingStatusDetails = Pick<
  Booking,
  "status" | "deposit_amount"
>;

export function getBookingStatusStyle(
  status: BookingStatus
) {
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

    default: {
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
    }
  }
}

export function getBookingDisplayStatus(
  booking: BookingStatusDetails
) {
  switch (booking.status) {
    case "Pending":
      return "Pending";

    case "Deposit Pending":
      return "Confirmed";

    case "Balance Pending":
      return booking.deposit_amount !== null &&
        booking.deposit_amount > 0
        ? "Deposit received"
        : "Balance due";

    case "Balance Paid":
      return "Full balance paid";

    case "Completed":
      return "Completed";

    case "Cancelled":
      return "Cancelled";

    default: {
      const exhaustiveCheck: never =
        booking.status;

      return exhaustiveCheck;
    }
  }
}