import { formatDisplayDate, formatMoney, formatName } from "@/lib/helpers";

import type { BookingPricingResult } from "@/lib/booking-engine/pricing";

type BookingConfirmationPayloadInput = {
  bookingReference: string;
  customerEmail: string | null | undefined;
  customerName: string;
  dogName: string | null | undefined;
  bookingType: "boarding" | "daycare";
  daycareSession: "full_day" | "half_day" | null;
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
  bookingType: "boarding" | "daycare";
  daycareSession: "full_day" | "half_day" | null;
  startDate: string;
  endDate: string;
  totalCost: string;
  depositAmount: string;
  balanceAmount: string;
  shortNoticeBooking: boolean;
};

type BookingCalendarPayloadInput = {
  bookingId: string;
  bookingReference: string;
  customerName: string;
  customerEmail: string | null | undefined;
  dogName: string | null | undefined;
  dogBreed: string | null | undefined;
  bookingType: "boarding" | "daycare";
  daycareSession: "full_day" | "half_day" | null;
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
  bookingType: "boarding" | "daycare";
  daycareSession: "full_day" | "half_day" | null;
  startDate: string;
  endDate: string;
  bookingStatus: string;
  paymentStatus: string;
  totalCost: string;
  depositAmount: string;
  balanceAmount: string;
  notes: string | null;
};

function formatDogName(dogName: string | null | undefined, fallback: string) {
  const value = dogName?.trim() || "";

  if (!value) {
    return fallback;
  }

  /*
   * A multi-dog name such as "Milo and Bella" must not be
   * passed through formatName as one personal-name value.
   * Each name was already formatted when the dog details
   * were created.
   */
  if (value.includes(" and ") || value.includes(",")) {
    return value;
  }

  return formatName(value) || fallback;
}

export function buildBookingConfirmationEmailPayload(
  input: BookingConfirmationPayloadInput,
): BookingConfirmationEmailPayload {
  return {
    bookingReference: input.bookingReference,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    dogName: formatDogName(input.dogName, "your dog"),
    bookingType: input.bookingType,
    daycareSession: input.daycareSession,
    startDate: formatDisplayDate(input.startDate),
    endDate: formatDisplayDate(input.endDate),
    totalCost: formatMoney(input.pricing.totalCost),
    depositAmount: formatMoney(input.pricing.depositAmount),
    balanceAmount: formatMoney(input.pricing.balanceAmount),
    shortNoticeBooking: input.shortNoticeBooking,
  };
}

export function buildBookingCalendarPayload(
  input: BookingCalendarPayloadInput,
): BookingCalendarPayload {
  return {
    bookingId: input.bookingId,
    bookingReference: input.bookingReference,
    ownerName: input.customerName,
    ownerEmail: input.customerEmail || null,
    dogName: formatDogName(input.dogName, "Dog"),
    dogBreed: input.dogBreed?.trim() || null,
    bookingType: input.bookingType,
    daycareSession: input.daycareSession,
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
