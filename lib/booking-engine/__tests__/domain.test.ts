import { describe, expect, it } from "vitest";

import {
  calculateBookingSpaceUnits,
  getBookingOccupiedDates,
  normaliseBookingDogIds,
  validateBookingDogs,
  validateBookingEngineRequest,
} from "@/lib/booking-engine/domain";

describe("Booking Engine V2 domain rules", () => {
  it("calculates boarding occupied dates without the departure date", () => {
    expect(
      getBookingOccupiedDates({
        bookingType: "boarding",
        startDate: "2026-09-10",
        endDate: "2026-09-13",
      }),
    ).toEqual(["2026-09-10", "2026-09-11", "2026-09-12"]);
  });

  it("calculates one occupied date for same-day daycare", () => {
    expect(
      getBookingOccupiedDates({
        bookingType: "daycare",
        startDate: "2026-09-10",
        endDate: "2026-09-10",
      }),
    ).toEqual(["2026-09-10"]);
  });

  it("rejects daycare with different start and end dates", () => {
    const result = validateBookingEngineRequest(
      {
        ownerId: "owner-1",
        dogIds: ["dog-1"],
        bookingType: "daycare",
        daycareSession: "full_day",
        startDate: "2026-09-10",
        endDate: "2026-09-11",
      },
      {
        today: "2026-08-22",
      },
    );

    expect(result).toEqual({
      valid: false,
      error: "A daycare booking must start and end on the same date.",
    });
  });

  it("requires a daycare session for daycare bookings", () => {
    const result = validateBookingEngineRequest(
      {
        ownerId: "owner-1",
        dogIds: ["dog-1"],
        bookingType: "daycare",
        daycareSession: null,
        startDate: "2026-09-10",
        endDate: "2026-09-10",
      },
      {
        today: "2026-08-22",
      },
    );

    expect(result).toEqual({
      valid: false,
      error: "Please select a full-day or half-day daycare session.",
    });
  });

  it("rejects a daycare session on a boarding booking", () => {
    const result = validateBookingEngineRequest(
      {
        ownerId: "owner-1",
        dogIds: ["dog-1"],
        bookingType: "boarding",
        daycareSession: "half_day",
        startDate: "2026-09-10",
        endDate: "2026-09-11",
      },
      {
        today: "2026-08-22",
      },
    );

    expect(result).toEqual({
      valid: false,
      error: "A daycare session cannot be selected for a boarding booking.",
    });
  });

  it("accepts two dogs from the same household", () => {
    const result = validateBookingEngineRequest(
      {
        ownerId: "owner-1",
        dogIds: ["dog-1", "dog-2"],
        bookingType: "boarding",
        daycareSession: null,
        startDate: "2026-09-10",
        endDate: "2026-09-12",
      },
      {
        today: "2026-08-22",
      },
    );

    expect(result.valid).toBe(true);

    if (!result.valid) {
      throw new Error(result.error);
    }

    expect(result.request.dogIds).toEqual(["dog-1", "dog-2"]);

    expect(result.request.primaryDogId).toBe("dog-1");
    expect(result.request.spaceUnits).toBe(1);
  });

  it("rejects more than two dogs", () => {
    const result = validateBookingEngineRequest(
      {
        ownerId: "owner-1",
        dogIds: ["dog-1", "dog-2", "dog-3"],
        bookingType: "boarding",
        daycareSession: null,
        startDate: "2026-09-10",
        endDate: "2026-09-12",
      },
      {
        today: "2026-08-22",
      },
    );

    expect(result).toEqual({
      valid: false,
      error: "A booking can include no more than 2 dogs.",
    });
  });

  it("removes blank and duplicate dog IDs", () => {
    expect(
      normaliseBookingDogIds([" dog-1 ", "", "dog-2", "dog-1", null]),
    ).toEqual(["dog-1", "dog-2"]);
  });

  it("uses one space unit for one household booking", () => {
    expect(calculateBookingSpaceUnits(1)).toBe(1);
    expect(calculateBookingSpaceUnits(2)).toBe(1);
  });

  it("rejects an inactive selected dog", () => {
    const result = validateBookingDogs({
      ownerId: "owner-1",
      selectedDogIds: ["dog-1"],
      dogs: [
        {
          id: "dog-1",
          owner_id: "owner-1",
          active: false,
          can_share_with_other_dogs: true,
        },
      ],
    });

    expect(result.valid).toBe(false);
  });

  it("rejects a dog belonging to another customer", () => {
    const result = validateBookingDogs({
      ownerId: "owner-1",
      selectedDogIds: ["dog-1"],
      dogs: [
        {
          id: "dog-1",
          owner_id: "owner-2",
          active: true,
          can_share_with_other_dogs: true,
        },
      ],
    });

    expect(result).toEqual({
      valid: false,
      error: "Every selected dog must belong to the booking customer.",
    });
  });

  it("marks a household as unable to share when one selected dog cannot share", () => {
    const result = validateBookingDogs({
      ownerId: "owner-1",
      selectedDogIds: ["dog-1", "dog-2"],
      dogs: [
        {
          id: "dog-1",
          owner_id: "owner-1",
          active: true,
          can_share_with_other_dogs: true,
        },
        {
          id: "dog-2",
          owner_id: "owner-1",
          active: true,
          can_share_with_other_dogs: false,
        },
      ],
    });

    expect(result.valid).toBe(true);

    if (!result.valid) {
      throw new Error(result.error);
    }

    expect(result.canShareWithOtherHouseholds).toBe(false);
  });
});
