export type BookingStatus =
  | "Pending"
  | "Deposit Pending"
  | "Balance Pending"
  | "Balance Paid"
  | "Completed"
  | "Cancelled";

export type BookingFilter = "Live" | "All" | BookingStatus;

export type BookingType = "boarding" | "daycare";

export type DaycareSessionType = "full_day" | "half_day";

export type BookingDogSummary = {
  id?: string;
  name: string;
  breed: string | null;
  can_share_with_other_dogs?: boolean;
};

export type BookingDogLink = {
  id: string;
  booking_id: string;
  dog_id: string;
  sort_order: number;
  created_at: string;
  dogs: BookingDogSummary | null;
};

export type BookingCustomerSummary = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type Booking = {
  id: string;
  booking_reference: string;
  owner_id: string;

  /**
   * Compatibility field used by the existing booking workflow.
   * For Booking Engine V2, booking_dogs is the authoritative list.
   */
  dog_id: string;

  booking_type: BookingType;
  daycare_session: DaycareSessionType | null;

  start_date: string;
  end_date: string;
  status: BookingStatus;
  notes: string | null;
  created_at: string;

  availability_confirmation_required: boolean;
  availability_confirmed_at: string | null;
  availability_confirmed_by: string | null;
  space_units: number;

  pricing_setting_id: string | null;
  nightly_rate: number | null;
  number_of_nights: number | null;
  total_cost: number | null;
  deposit_amount: number | null;
  balance_amount: number | null;
  deposit_paid_at: string | null;
  balance_paid_at: string | null;

  /**
   * Existing single-dog relation retained during the V2 transition.
   */
  dogs: BookingDogSummary | null;

  /**
   * Multi-dog relation used by Booking Engine V2.
   * Optional until all booking queries have been migrated.
   */
  booking_dogs?: BookingDogLink[];
};

export type BookingWithCustomer = Booking & {
  customer: BookingCustomerSummary | null;
};

export type BookingPaymentType = "Deposit" | "Additional Deposit" | "Balance";

export type BookingPaymentResult = {
  id: string;
  invoiceNumber: string;
  type: BookingPaymentType;
  amount: number;
  date: string;
};

export type BookingActionResult = {
  success: boolean;
  followUpRequired: boolean;
  message?: string;
  error?: string;
};

export const BOOKING_TYPES: BookingType[] = ["boarding", "daycare"];

export const DAYCARE_SESSION_TYPES: DaycareSessionType[] = [
  "full_day",
  "half_day",
];

export const BOOKING_STATUSES: BookingStatus[] = [
  "Pending",
  "Deposit Pending",
  "Balance Pending",
  "Balance Paid",
  "Completed",
  "Cancelled",
];

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  "Pending",
  "Deposit Pending",
  "Balance Pending",
  "Balance Paid",
];

export const CONFIRMED_BOOKING_STATUSES: BookingStatus[] = [
  "Deposit Pending",
  "Balance Pending",
  "Balance Paid",
];

export const CANCELLABLE_BOOKING_STATUSES: BookingStatus[] = [
  "Pending",
  "Deposit Pending",
  "Balance Pending",
  "Balance Paid",
];

export function isBookingType(value: unknown): value is BookingType {
  return value === "boarding" || value === "daycare";
}

export function isDaycareSessionType(
  value: unknown,
): value is DaycareSessionType {
  return value === "full_day" || value === "half_day";
}

export function getBookingTypeLabel(bookingType: BookingType) {
  return bookingType === "daycare" ? "Doggy Day Care" : "Boarding";
}

export function getDaycareSessionLabel(sessionType: DaycareSessionType | null) {
  switch (sessionType) {
    case "full_day":
      return "Full Day";

    case "half_day":
      return "Half Day";

    default:
      return "";
  }
}
