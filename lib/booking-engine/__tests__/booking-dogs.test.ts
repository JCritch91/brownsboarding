import { describe, expect, it } from "vitest";

import {
  formatBookingDogBreeds,
  formatBookingDogNames,
  validateDogsForBookingConfirmation,
  type BookingDogDetails,
} from "@/lib/booking-engine/booking-dogs";

const firstDog: BookingDogDetails = {
  id: "dog-1",
  owner_id: "owner-1",
  name: "Milo",
  breed: "Labrador",
  active: true,
  vaccinated: true,
  vaccination_expiry: "2027-01-01",
  meet_and_greet_completed: true,
  can_share_with_other_dogs: true,
};

const secondDog: BookingDogDetails = {
  id: "dog-2",
  owner_id: "owner-1",
  name: "Bella",
  breed: "Spaniel",
  active: true,
  vaccinated: true,
  vaccination_expiry: "2027-02-01",
  meet_and_greet_completed: true,
  can_share_with_other_dogs: true,
};

describe("Booking Engine V2 booking dogs", () => {
  it("validates two eligible dogs belonging to the booking customer", () => {
    const result = validateDogsForBookingConfirmation({
      ownerId: "owner-1",
      bookingStartDate: "2026-09-20",
      dogs: [secondDog, firstDog],
      bookingDogLinks: [
        {
          dog_id: "dog-1",
          sort_order: 0,
        },
        {
          dog_id: "dog-2",
          sort_order: 1,
        },
      ],
    });

    expect(result.valid).toBe(true);

    if (!result.valid) {
      throw new Error(result.error);
    }

    expect(result.primaryDog.id).toBe("dog-1");

    expect(result.dogNames).toEqual(["Milo", "Bella"]);

    expect(result.allDogsCanShare).toBe(true);
  });

  it("rejects a linked dog belonging to another customer", () => {
    const result = validateDogsForBookingConfirmation({
      ownerId: "owner-1",
      bookingStartDate: "2026-09-20",
      dogs: [
        {
          ...firstDog,
          owner_id: "owner-2",
        },
      ],
      bookingDogLinks: [
        {
          dog_id: "dog-1",
          sort_order: 0,
        },
      ],
    });

    expect(result).toEqual({
      valid: false,
      error: "Milo does not belong to the booking customer.",
    });
  });

  it("rejects an inactive linked dog", () => {
    const result = validateDogsForBookingConfirmation({
      ownerId: "owner-1",
      bookingStartDate: "2026-09-20",
      dogs: [
        {
          ...firstDog,
          active: false,
        },
      ],
      bookingDogLinks: [
        {
          dog_id: "dog-1",
          sort_order: 0,
        },
      ],
    });

    expect(result).toEqual({
      valid: false,
      error: "Milo is inactive and cannot be included in a confirmed booking.",
    });
  });

  it("rejects a linked dog without vaccination information", () => {
    const result = validateDogsForBookingConfirmation({
      ownerId: "owner-1",
      bookingStartDate: "2026-09-20",
      dogs: [
        {
          ...firstDog,
          vaccinated: false,
        },
      ],
      bookingDogLinks: [
        {
          dog_id: "dog-1",
          sort_order: 0,
        },
      ],
    });

    expect(result).toEqual({
      valid: false,
      error: "Milo's vaccination information is incomplete.",
    });
  });

  it("rejects a linked dog whose vaccination expires before the booking", () => {
    const result = validateDogsForBookingConfirmation({
      ownerId: "owner-1",
      bookingStartDate: "2026-09-20",
      dogs: [
        {
          ...firstDog,
          vaccination_expiry: "2026-09-19",
        },
      ],
      bookingDogLinks: [
        {
          dog_id: "dog-1",
          sort_order: 0,
        },
      ],
    });

    expect(result).toEqual({
      valid: false,
      error: "Milo's vaccination will have expired before the booking begins.",
    });
  });

  it("reports when one linked dog cannot share", () => {
    const result = validateDogsForBookingConfirmation({
      ownerId: "owner-1",
      bookingStartDate: "2026-09-20",
      dogs: [
        firstDog,
        {
          ...secondDog,
          can_share_with_other_dogs: false,
        },
      ],
      bookingDogLinks: [
        {
          dog_id: "dog-1",
          sort_order: 0,
        },
        {
          dog_id: "dog-2",
          sort_order: 1,
        },
      ],
    });

    expect(result.valid).toBe(true);

    if (!result.valid) {
      throw new Error(result.error);
    }

    expect(result.allDogsCanShare).toBe(false);
  });

  it("formats one or two dog names", () => {
    expect(formatBookingDogNames([firstDog])).toBe("Milo");

    expect(formatBookingDogNames([firstDog, secondDog])).toBe("Milo and Bella");
  });

  it("formats available dog breeds", () => {
    expect(formatBookingDogBreeds([firstDog, secondDog])).toBe(
      "Labrador, Spaniel",
    );

    expect(
      formatBookingDogBreeds([
        {
          ...firstDog,
          breed: null,
        },
      ]),
    ).toBeNull();
  });
});
