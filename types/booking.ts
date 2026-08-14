export type BookingStatus =
  | "Pending"
  | "Deposit Pending"
  | "Balance Pending"
  | "Balance Paid"
  | "Completed"
  | "Cancelled";

export type BookingFilter =
| "All"
| BookingStatus;


export type BookingDogSummary = {
  name: string;
  breed: string | null;
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
  dog_id: string;
  start_date: string;
  end_date: string;
  status: BookingStatus;
  notes: string | null;
  created_at: string;

  pricing_setting_id: string | null;
  nightly_rate: number | null;
  number_of_nights: number | null;
  total_cost: number | null;
  deposit_amount: number | null;
  balance_amount: number | null;

  deposit_paid_at: string | null;
  balance_paid_at: string | null;

  dogs: BookingDogSummary | null;
};

export type BookingWithCustomer = Booking & {
  customer: BookingCustomerSummary | null;
};

export type BookingPaymentType =
  | "Deposit"
  | "Balance";

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