import { formatDisplayDate, formatMoney, formatName } from "@/lib/helpers";

import type { BookingPricingResult } from "@/lib/services/booking-confirmation-service";

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
  input: BookingConfirmationPayloadInput,
): BookingConfirmationEmailPayload {
  return {
    bookingReference: input.bookingReference,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    dogName: formatName(input.dogName || "") || "your dog",
    startDate: formatDisplayDate(input.startDate),
    endDate: formatDisplayDate(input.endDate),
    totalCost: formatMoney(input.pricing.totalCost),
    depositAmount: formatMoney(input.pricing.depositAmount),
    balanceAmount: formatMoney(input.pricing.balanceAmount),
    shortNoticeBooking: input.shortNoticeBooking,
  };
}

export type BookingCalendarPayloadInput = {
  bookingId: string;
  bookingReference: string;
  customerName: string;
  customerEmail: string | null | undefined;
  dogName: string | null | undefined;
  dogBreed: string | null | undefined;
  startDate: string;
  endDate: string;
  bookingStatus: string;
  paymentStatus: string;
  notes: string | null;
  pricing: BookingPricingResult;
};

export type BookingCalendarPayload = {
  bookingId: string;
  bookingReference: string;
  ownerName: string;
  ownerEmail: string | null;
  dogName: string;
  dogBreed: string | null;
  startDate: string;
  endDate: string;
  bookingStatus: string;
  paymentStatus: string;
  totalCost: string;
  depositAmount: string;
  balanceAmount: string;
  notes: string | null;
};

export function buildBookingCalendarPayload(
  input: BookingCalendarPayloadInput,
): BookingCalendarPayload {
  return {
    bookingId: input.bookingId,
    bookingReference: input.bookingReference,
    ownerName: input.customerName,
    ownerEmail: input.customerEmail || null,
    dogName: formatName(input.dogName || "") || "Dog",
    dogBreed: input.dogBreed ? formatName(input.dogBreed) : null,
    startDate: input.startDate,
    endDate: input.endDate,
    bookingStatus: input.bookingStatus,
    paymentStatus: input.paymentStatus,
    totalCost: formatMoney(input.pricing.totalCost),
    depositAmount: formatMoney(input.pricing.depositAmount),
    balanceAmount: formatMoney(input.pricing.balanceAmount),
    notes: input.notes,
  };
}
