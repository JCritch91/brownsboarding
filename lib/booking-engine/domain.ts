import {
  isBookingType,
  isDaycareSessionType,
  type BookingType,
  type DaycareSessionType,
} from "@/types/booking";

export type BookingEngineDog = {
  id: string;
  owner_id: string;
  active: boolean;
  can_share_with_other_dogs: boolean;
};

export type BookingEngineRequest = {
  ownerId: string;
  dogIds: string[];
  bookingType: BookingType;
  daycareSession: DaycareSessionType | null;
  startDate: string;
  endDate: string;
};

export type ValidatedBookingEngineRequest = {
  ownerId: string;
  dogIds: string[];
  primaryDogId: string;
  bookingType: BookingType;
  daycareSession: DaycareSessionType | null;
  startDate: string;
  endDate: string;
  occupiedDates: string[];
  spaceUnits: number;
};

export type BookingRequestValidationResult =
  | {
      valid: true;
      request: ValidatedBookingEngineRequest;
    }
  | {
      valid: false;
      error: string;
    };

export type BookingDogValidationResult =
  | {
      valid: true;
      dogs: BookingEngineDog[];
      canShareWithOtherHouseholds: boolean;
    }
  | {
      valid: false;
      error: string;
    };

const DATABASE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDatabaseDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATABASE_DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function getCurrentDatabaseDate() {
  return new Date().toISOString().slice(0, 10);
}

export function normaliseBookingDogIds(dogIds: readonly unknown[]): string[] {
  const normalisedDogIds = dogIds
    .filter(
      (dogId): dogId is string =>
        typeof dogId === "string" && dogId.trim().length > 0,
    )
    .map((dogId) => dogId.trim());

  return Array.from(new Set(normalisedDogIds));
}

export function getBookingOccupiedDates({
  bookingType,
  startDate,
  endDate,
}: {
  bookingType: BookingType;
  startDate: string;
  endDate: string;
}) {
  if (!isValidDatabaseDate(startDate) || !isValidDatabaseDate(endDate)) {
    return [];
  }

  if (bookingType === "daycare") {
    return startDate === endDate ? [startDate] : [];
  }

  if (endDate <= startDate) {
    return [];
  }

  const occupiedDates: string[] = [];
  const currentDate = new Date(`${startDate}T00:00:00Z`);
  const departureDate = new Date(`${endDate}T00:00:00Z`);

  while (currentDate < departureDate) {
    occupiedDates.push(currentDate.toISOString().slice(0, 10));
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return occupiedDates;
}

export function calculateBookingSpaceUnits(dogCount: number): number {
  if (!Number.isInteger(dogCount) || dogCount < 1) {
    throw new Error("A booking must contain at least one dog.");
  }

  /*
   * Dogs included in one booking belong to the same
   * customer household and normally consume one configured
   * facility space. Cross-household compatibility is handled
   * separately by the availability engine.
   */
  return 1;
}

export function validateBookingEngineRequest(
  request: BookingEngineRequest,
  options?: {
    today?: string;
    maximumDogs?: number;
  },
): BookingRequestValidationResult {
  const today = options?.today || getCurrentDatabaseDate();

  const maximumDogs = options?.maximumDogs ?? 2;

  if (!request.ownerId.trim()) {
    return {
      valid: false,
      error: "The booking customer is missing.",
    };
  }

  const dogIds = normaliseBookingDogIds(request.dogIds);

  if (dogIds.length === 0) {
    return {
      valid: false,
      error: "Please select at least one dog.",
    };
  }

  if (dogIds.length > maximumDogs) {
    return {
      valid: false,
      error: `A booking can include no more than ${maximumDogs} dogs.`,
    };
  }

  if (!isBookingType(request.bookingType)) {
    return {
      valid: false,
      error: "Please select a valid booking type.",
    };
  }

  if (
    request.bookingType === "daycare" &&
    !isDaycareSessionType(request.daycareSession)
  ) {
    return {
      valid: false,
      error: "Please select a full-day or half-day daycare session.",
    };
  }

  if (request.bookingType === "boarding" && request.daycareSession !== null) {
    return {
      valid: false,
      error: "A daycare session cannot be selected for a boarding booking.",
    };
  }

  if (!isValidDatabaseDate(request.startDate)) {
    return {
      valid: false,
      error: "Please select a valid start date.",
    };
  }

  if (!isValidDatabaseDate(request.endDate)) {
    return {
      valid: false,
      error: "Please select a valid end date.",
    };
  }

  if (request.startDate < today) {
    return {
      valid: false,
      error: "The booking start date cannot be in the past.",
    };
  }

  if (request.bookingType === "boarding") {
    if (request.endDate <= request.startDate) {
      return {
        valid: false,
        error: "A boarding booking must end after its start date.",
      };
    }
  }

  if (
    request.bookingType === "daycare" &&
    request.endDate !== request.startDate
  ) {
    return {
      valid: false,
      error: "A daycare booking must start and end on the same date.",
    };
  }

  const occupiedDates = getBookingOccupiedDates({
    bookingType: request.bookingType,
    startDate: request.startDate,
    endDate: request.endDate,
  });

  if (occupiedDates.length === 0) {
    return {
      valid: false,
      error:
        request.bookingType === "daycare"
          ? "The daycare booking must contain one attendance date."
          : "The boarding booking must contain at least one occupied night.",
    };
  }

  return {
    valid: true,
    request: {
      ownerId: request.ownerId.trim(),
      dogIds,
      primaryDogId: dogIds[0],
      bookingType: request.bookingType,
      daycareSession:
        request.bookingType === "daycare" ? request.daycareSession : null,
      startDate: request.startDate,
      endDate: request.endDate,
      occupiedDates,
      spaceUnits: calculateBookingSpaceUnits(dogIds.length),
    },
  };
}

export function validateBookingDogs({
  dogs,
  ownerId,
  selectedDogIds,
}: {
  dogs: BookingEngineDog[];
  ownerId: string;
  selectedDogIds: string[];
}): BookingDogValidationResult {
  const dogById = new Map(dogs.map((dog) => [dog.id, dog]));

  const selectedDogs: BookingEngineDog[] = [];

  for (const dogId of selectedDogIds) {
    const dog = dogById.get(dogId);

    if (!dog) {
      return {
        valid: false,
        error: "One or more selected dogs could not be found.",
      };
    }

    if (dog.owner_id !== ownerId) {
      return {
        valid: false,
        error: "Every selected dog must belong to the booking customer.",
      };
    }

    if (!dog.active) {
      return {
        valid: false,
        error: `${dogId} is inactive and cannot be included in a booking.`,
      };
    }

    selectedDogs.push(dog);
  }

  return {
    valid: true,
    dogs: selectedDogs,
    canShareWithOtherHouseholds: selectedDogs.every(
      (dog) => dog.can_share_with_other_dogs,
    ),
  };
}
