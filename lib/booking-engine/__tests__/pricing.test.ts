import { describe, expect, it } from "vitest";

import {
  calculateBookingEnginePricing,
  isShortNoticeBooking,
  type BookingEnginePricingSettings,
} from "@/lib/booking-engine/pricing";

const pricing: BookingEnginePricingSettings = {
  id: "pricing-1",
  nightly_rate: 30,
  deposit_percentage: 25,
  daycare_full_day_rate: 40,
  daycare_half_day_rate: 25,
  daycare_deposit_percentage: 25,
  effective_from: "2026-01-01",
  active: true,
};

describe("Booking Engine V2 pricing", () => {
  it("prices a normal Boarding booking", () => {
    const result = calculateBookingEnginePricing({
      bookingType: "boarding",
      daycareSession: null,
      startDate: "2026-09-20",
      endDate: "2026-09-23",
      pricing,
      today: "2026-08-22",
    });

    expect(result).toEqual({
      pricingSettingId: "pricing-1",
      bookingType: "boarding",
      daycareSession: null,
      priceUnit: "boarding_night",
      unitRate: 30,
      quantity: 3,
      depositPercentage: 25,
      totalCost: 90,
      depositAmount: 22.5,
      balanceAmount: 67.5,
      shortNoticeBooking: false,
      newStatus: "Deposit Pending",
      numberOfNights: 3,
      nightlyRate: 30,
    });
  });

  it("requires full balance for short-notice Boarding", () => {
    const result = calculateBookingEnginePricing({
      bookingType: "boarding",
      daycareSession: null,
      startDate: "2026-08-30",
      endDate: "2026-09-02",
      pricing,
      today: "2026-08-22",
    });

    expect(result.totalCost).toBe(90);
    expect(result.depositAmount).toBe(0);
    expect(result.balanceAmount).toBe(90);
    expect(result.shortNoticeBooking).toBe(true);
    expect(result.newStatus).toBe("Balance Pending");
  });

  it("prices full-day Daycare", () => {
    const result = calculateBookingEnginePricing({
      bookingType: "daycare",
      daycareSession: "full_day",
      startDate: "2026-09-20",
      endDate: "2026-09-20",
      pricing,
      today: "2026-08-22",
    });

    expect(result.priceUnit).toBe("daycare_full_day");
    expect(result.unitRate).toBe(40);
    expect(result.quantity).toBe(1);
    expect(result.totalCost).toBe(40);
    expect(result.depositAmount).toBe(10);
    expect(result.balanceAmount).toBe(30);
    expect(result.numberOfNights).toBe(0);
    expect(result.nightlyRate).toBeNull();
  });

  it("prices half-day Daycare", () => {
    const result = calculateBookingEnginePricing({
      bookingType: "daycare",
      daycareSession: "half_day",
      startDate: "2026-09-20",
      endDate: "2026-09-20",
      pricing,
      today: "2026-08-22",
    });

    expect(result.priceUnit).toBe("daycare_half_day");
    expect(result.unitRate).toBe(25);
    expect(result.totalCost).toBe(25);
    expect(result.depositAmount).toBe(6.25);
    expect(result.balanceAmount).toBe(18.75);
  });

  it("requires full balance for short-notice Daycare", () => {
    const result = calculateBookingEnginePricing({
      bookingType: "daycare",
      daycareSession: "full_day",
      startDate: "2026-08-25",
      endDate: "2026-08-25",
      pricing,
      today: "2026-08-22",
    });

    expect(result.totalCost).toBe(40);
    expect(result.depositAmount).toBe(0);
    expect(result.balanceAmount).toBe(40);
    expect(result.newStatus).toBe("Balance Pending");
  });

  it("treats exactly 14 days as short notice", () => {
    expect(
      isShortNoticeBooking({
        today: "2026-08-22",
        startDate: "2026-09-05",
      }),
    ).toBe(true);
  });

  it("does not treat 15 days as short notice", () => {
    expect(
      isShortNoticeBooking({
        today: "2026-08-22",
        startDate: "2026-09-06",
      }),
    ).toBe(false);
  });

  it("rejects different dates for Daycare", () => {
    expect(() =>
      calculateBookingEnginePricing({
        bookingType: "daycare",
        daycareSession: "full_day",
        startDate: "2026-09-20",
        endDate: "2026-09-21",
        pricing,
        today: "2026-08-22",
      }),
    ).toThrow("A daycare booking must start and end on the same date.");
  });

  it("rejects a missing Daycare session", () => {
    expect(() =>
      calculateBookingEnginePricing({
        bookingType: "daycare",
        daycareSession: null,
        startDate: "2026-09-20",
        endDate: "2026-09-20",
        pricing,
        today: "2026-08-22",
      }),
    ).toThrow("Please select a full-day or half-day daycare session.");
  });
});
