export type BookingConfirmationResult = {
  success: boolean;
  error?: string;
};

export async function confirmBooking(
  bookingId: string
): Promise<BookingConfirmationResult> {
  return {
    success: true,
  };
}

export type BookingPricingResult = {
  numberOfNights: number;
  totalCost: number;
  depositAmount: number;
  balanceAmount: number;
  newStatus: string;
};

import {
  calculateNumberOfNights,
  isWithinTwoWeeks,
} from "@/lib/helpers";

export function calculateBookingPricing(
  startDate: string,
  endDate: string,
  nightlyRate: number,
  depositPercentage: number
): BookingPricingResult {
  const shortNoticeBooking =
    isWithinTwoWeeks(startDate);

  const numberOfNights =
    calculateNumberOfNights(
      startDate,
      endDate
    );

  const totalCost =
    numberOfNights * nightlyRate;

  const depositAmount = shortNoticeBooking
    ? 0
    : totalCost * (depositPercentage / 100);

  const balanceAmount =
    totalCost - depositAmount;

  const newStatus = shortNoticeBooking
    ? "Balance Pending"
    : "Deposit Pending";

  return {
    numberOfNights,
    totalCost,
    depositAmount,
    balanceAmount,
    newStatus,
  };
}