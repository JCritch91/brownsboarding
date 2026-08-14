import {
  formatDisplayDate,
  formatMoney,
  formatName,
} from "@/lib/helpers";

import type {
  BookingPricingResult,
} from "@/lib/services/booking-confirmation-service";

export type BookingConfirmationPayloadInput = {
  bookingReference: string;
  customerEmail: string | null | undefined;
  customerName: string;
  dogName: string | null | undefined;
  startDate: string;
  endDate: string;
  shortNoticeBooking: boolean;
  pricing: BookingPricingResult;
};

export type BookingConfirmationEmailPayload = {
  bookingReference: string;
  customerEmail: string | null | undefined;
  customerName: string;
  dogName: string;
  startDate: string;
  endDate: string;
  totalCost: string;
  depositAmount: string;
  balanceAmount: string;
  shortNoticeBooking: boolean;
};

export function buildBookingConfirmationEmailPayload(
  input: BookingConfirmationPayloadInput
): BookingConfirmationEmailPayload {
  return {
    bookingReference: input.bookingReference,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    dogName:
      formatName(input.dogName || "") || "your dog",
    startDate: formatDisplayDate(input.startDate),
    endDate: formatDisplayDate(input.endDate),
    totalCost: formatMoney(
      input.pricing.totalCost
    ),
    depositAmount: formatMoney(
      input.pricing.depositAmount
    ),
    balanceAmount: formatMoney(
      input.pricing.balanceAmount
    ),
    shortNoticeBooking:
      input.shortNoticeBooking,
  };
}