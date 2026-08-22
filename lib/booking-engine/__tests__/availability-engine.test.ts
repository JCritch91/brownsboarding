import { describe, expect, it } from "vitest";

import {
  evaluateAvailabilityDate,
  evaluateAvailabilityRange,
  type ExistingOccupancyBooking,
  type RequestedOccupancy,
} from "@/lib/booking-engine/availability-engine";

const shareableRequest: RequestedOccupancy = {
  ownerId: "owner-2",
  bookingType: "boarding",
  daycareSession: null,
  dogIds: ["dog-2"],
  canShareWithOtherHouseholds: true,
  spaceUnits: 1,
};

const existingShareableBooking: ExistingOccupancyBooking = {
  id: "booking-1",
  owner_id: "owner-1",
  booking_type: "boarding",
  daycare_session: null,
  start_date: "2026-09-10",
  end_date: "2026-09-12",
  space_units: 1,
  dogs: [
    {
      id: "dog-1",
      owner_id: "owner-1",
      can_share_with_other_dogs: true,
    },
  ],
};

describe("Booking Engine V2 availability rules", () => {
  it("allows a Pending request for a white unconfigured date", () => {
    const result = evaluateAvailabilityRange({
      occupiedDates: ["2026-09-10"],
      availabilityRecords: [],
      existingBookings: [],
      request: shareableRequest,
    });

    expect(result.decision).toBe("availability_review_required");

    expect(result.canSubmitPendingBooking).toBe(true);
    expect(result.canConfirmBooking).toBe(false);

    expect(result.availabilityConfirmationRequired).toBe(true);

    expect(result.unconfiguredDates).toEqual(["2026-09-10"]);

    expect(result.warning).toContain("Browns Boarding will confirm");
  });

  it("blocks a date explicitly marked unavailable", () => {
    const result = evaluateAvailabilityDate({
      date: "2026-09-10",
      availability: {
        id: "availability-1",
        date: "2026-09-10",
        available: false,
        total_spaces: 0,
        spaces_available: 0,
        notes: null,
      },
      existingBookings: [],
      request: shareableRequest,
    });

    expect(result.decision).toBe("unavailable");
    expect(result.reason).toBe("configured_unavailable");
  });

  it("allows a booking when one configured space is available", () => {
    const result = evaluateAvailabilityDate({
      date: "2026-09-10",
      availability: {
        id: "availability-1",
        date: "2026-09-10",
        available: true,
        total_spaces: 1,
        spaces_available: 1,
        notes: null,
      },
      existingBookings: [],
      request: shareableRequest,
    });

    expect(result.decision).toBe("available");

    expect(result.reason).toBe("configured_capacity_available");
  });

  it("allows one compatible shared booking after configured capacity reaches zero", () => {
    const result = evaluateAvailabilityDate({
      date: "2026-09-10",
      availability: {
        id: "availability-1",
        date: "2026-09-10",
        available: true,
        total_spaces: 1,
        spaces_available: 0,
        notes: null,
      },
      existingBookings: [existingShareableBooking],
      request: shareableRequest,
    });

    expect(result.decision).toBe("available");

    expect(result.reason).toBe("compatible_shared_booking_available");
  });

  it("allows daycare as the compatible shared booking", () => {
    const result = evaluateAvailabilityDate({
      date: "2026-09-10",
      availability: {
        id: "availability-1",
        date: "2026-09-10",
        available: true,
        total_spaces: 1,
        spaces_available: 0,
        notes: null,
      },
      existingBookings: [existingShareableBooking],
      request: {
        ...shareableRequest,
        bookingType: "daycare",
        daycareSession: "full_day",
      },
    });

    expect(result.decision).toBe("available");

    expect(result.reason).toBe("compatible_shared_booking_available");
  });

  it("blocks shared capacity when a requested dog cannot share", () => {
    const result = evaluateAvailabilityDate({
      date: "2026-09-10",
      availability: {
        id: "availability-1",
        date: "2026-09-10",
        available: true,
        total_spaces: 1,
        spaces_available: 0,
        notes: null,
      },
      existingBookings: [existingShareableBooking],
      request: {
        ...shareableRequest,
        canShareWithOtherHouseholds: false,
      },
    });

    expect(result.decision).toBe("unavailable");

    expect(result.reason).toBe("requested_dog_cannot_share");
  });

  it("blocks shared capacity when an existing dog cannot share", () => {
    const result = evaluateAvailabilityDate({
      date: "2026-09-10",
      availability: {
        id: "availability-1",
        date: "2026-09-10",
        available: true,
        total_spaces: 1,
        spaces_available: 0,
        notes: null,
      },
      existingBookings: [
        {
          ...existingShareableBooking,
          dogs: [
            {
              id: "dog-1",
              owner_id: "owner-1",
              can_share_with_other_dogs: false,
            },
          ],
        },
      ],
      request: shareableRequest,
    });

    expect(result.decision).toBe("unavailable");

    expect(result.reason).toBe("existing_dog_cannot_share");
  });

  it("blocks a second overflow household booking", () => {
    const result = evaluateAvailabilityDate({
      date: "2026-09-10",
      availability: {
        id: "availability-1",
        date: "2026-09-10",
        available: true,
        total_spaces: 1,
        spaces_available: 0,
        notes: null,
      },
      existingBookings: [
        existingShareableBooking,
        {
          ...existingShareableBooking,
          id: "booking-2",
          owner_id: "owner-2",
          dogs: [
            {
              id: "dog-2",
              owner_id: "owner-2",
              can_share_with_other_dogs: true,
            },
          ],
        },
      ],
      request: {
        ...shareableRequest,
        ownerId: "owner-3",
        dogIds: ["dog-3"],
      },
    });

    expect(result.decision).toBe("unavailable");

    expect(result.reason).toBe("shared_booking_limit_reached");
  });

  it("makes the complete range unavailable when one occupied date is blocked", () => {
    const result = evaluateAvailabilityRange({
      occupiedDates: ["2026-09-10", "2026-09-11"],
      availabilityRecords: [
        {
          id: "availability-1",
          date: "2026-09-10",
          available: true,
          total_spaces: 1,
          spaces_available: 1,
          notes: null,
        },
        {
          id: "availability-2",
          date: "2026-09-11",
          available: false,
          total_spaces: 0,
          spaces_available: 0,
          notes: null,
        },
      ],
      existingBookings: [],
      request: shareableRequest,
    });

    expect(result.decision).toBe("unavailable");
    expect(result.canSubmitPendingBooking).toBe(false);
    expect(result.unavailableDates).toEqual(["2026-09-11"]);
  });
});
