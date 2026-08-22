import type { BookingType, DaycareSessionType } from "@/types/booking";

export type AvailabilityDecision =
  "available" | "availability_review_required" | "unavailable";

export type AvailabilityReason =
  | "configured_capacity_available"
  | "unconfigured_date"
  | "configured_unavailable"
  | "compatible_shared_booking_available"
  | "requested_dog_cannot_share"
  | "existing_dog_cannot_share"
  | "shared_booking_limit_reached";

export type AvailabilityRecord = {
  id: string;
  date: string;
  available: boolean;
  total_spaces: number;
  spaces_available: number;
  notes: string | null;
};

export type ExistingOccupancyDog = {
  id: string;
  owner_id: string;
  can_share_with_other_dogs: boolean;
};

export type ExistingOccupancyBooking = {
  id: string;
  owner_id: string;
  booking_type: BookingType;
  daycare_session: DaycareSessionType | null;
  start_date: string;
  end_date: string;
  space_units: number;
  dogs: ExistingOccupancyDog[];
};

export type RequestedOccupancy = {
  ownerId: string;
  bookingType: BookingType;
  daycareSession: DaycareSessionType | null;
  dogIds: string[];
  canShareWithOtherHouseholds: boolean;
  spaceUnits: number;
};

export type AvailabilityDateEvaluation = {
  date: string;
  decision: AvailabilityDecision;
  reason: AvailabilityReason;
  message: string;
  availabilityConfigured: boolean;
  totalSpaces: number | null;
  spacesAvailable: number | null;
  confirmedBookings: number;
  sharedOverflowBookings: number;
};

export type AvailabilityRangeEvaluation = {
  decision: AvailabilityDecision;
  availabilityConfirmationRequired: boolean;
  canSubmitPendingBooking: boolean;
  canConfirmBooking: boolean;
  unconfiguredDates: string[];
  unavailableDates: string[];
  sharedDates: string[];
  evaluations: AvailabilityDateEvaluation[];
  warning: string | null;
  error: string | null;
};

const MAX_SHARED_OVERFLOW_BOOKINGS = 1;

function getBookingOccupiedDates(booking: ExistingOccupancyBooking): string[] {
  if (booking.booking_type === "daycare") {
    return booking.start_date === booking.end_date ? [booking.start_date] : [];
  }

  if (booking.end_date <= booking.start_date) {
    return [];
  }

  const occupiedDates: string[] = [];
  const currentDate = new Date(`${booking.start_date}T00:00:00Z`);
  const endDate = new Date(`${booking.end_date}T00:00:00Z`);

  while (currentDate < endDate) {
    occupiedDates.push(currentDate.toISOString().slice(0, 10));

    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return occupiedDates;
}

function bookingOccupiesDate(booking: ExistingOccupancyBooking, date: string) {
  return getBookingOccupiedDates(booking).includes(date);
}

function allExistingDogsCanShare(bookings: ExistingOccupancyBooking[]) {
  return bookings.every(
    (booking) =>
      booking.dogs.length > 0 &&
      booking.dogs.every((dog) => dog.can_share_with_other_dogs),
  );
}

function getSharedOverflowBookingCount({
  bookings,
  availability,
}: {
  bookings: ExistingOccupancyBooking[];
  availability: AvailabilityRecord;
}) {
  const configuredSpaceUnitsConsumed =
    availability.total_spaces - availability.spaces_available;

  const confirmedSpaceUnits = bookings.reduce(
    (total, booking) => total + Math.max(1, booking.space_units),
    0,
  );

  return Math.max(0, confirmedSpaceUnits - configuredSpaceUnitsConsumed);
}

function formatUnconfiguredAvailabilityWarning(dates: string[]) {
  if (dates.length === 1) {
    return `Availability has not yet been confirmed for ${dates[0]}. You can still submit this booking request and Browns Boarding will confirm whether the booking can be accommodated.`;
  }

  return `Availability has not yet been confirmed for ${dates.length} selected dates. You can still submit this booking request and Browns Boarding will confirm whether the booking can be accommodated.`;
}

export function evaluateAvailabilityDate({
  date,
  availability,
  existingBookings,
  request,
}: {
  date: string;
  availability: AvailabilityRecord | null;
  existingBookings: ExistingOccupancyBooking[];
  request: RequestedOccupancy;
}): AvailabilityDateEvaluation {
  const dateBookings = existingBookings.filter((booking) =>
    bookingOccupiesDate(booking, date),
  );

  if (!availability) {
    return {
      date,
      decision: "availability_review_required",
      reason: "unconfigured_date",
      message: "Availability has not yet been configured for this date.",
      availabilityConfigured: false,
      totalSpaces: null,
      spacesAvailable: null,
      confirmedBookings: dateBookings.length,
      sharedOverflowBookings: 0,
    };
  }

  if (!availability.available) {
    return {
      date,
      decision: "unavailable",
      reason: "configured_unavailable",
      message: `${date} has been marked as unavailable.`,
      availabilityConfigured: true,
      totalSpaces: availability.total_spaces,
      spacesAvailable: availability.spaces_available,
      confirmedBookings: dateBookings.length,
      sharedOverflowBookings: 0,
    };
  }

  if (availability.spaces_available > 0) {
    return {
      date,
      decision: "available",
      reason: "configured_capacity_available",
      message: `${date} has configured availability.`,
      availabilityConfigured: true,
      totalSpaces: availability.total_spaces,
      spacesAvailable: availability.spaces_available,
      confirmedBookings: dateBookings.length,
      sharedOverflowBookings: 0,
    };
  }

  if (!request.canShareWithOtherHouseholds) {
    return {
      date,
      decision: "unavailable",
      reason: "requested_dog_cannot_share",
      message:
        "One or more selected dogs cannot share with dogs from another household.",
      availabilityConfigured: true,
      totalSpaces: availability.total_spaces,
      spacesAvailable: availability.spaces_available,
      confirmedBookings: dateBookings.length,
      sharedOverflowBookings: 0,
    };
  }

  if (!allExistingDogsCanShare(dateBookings)) {
    return {
      date,
      decision: "unavailable",
      reason: "existing_dog_cannot_share",
      message:
        "A dog already attending on this date cannot share with dogs from another household.",
      availabilityConfigured: true,
      totalSpaces: availability.total_spaces,
      spacesAvailable: availability.spaces_available,
      confirmedBookings: dateBookings.length,
      sharedOverflowBookings: 0,
    };
  }

  const sharedOverflowBookings = getSharedOverflowBookingCount({
    bookings: dateBookings,
    availability,
  });

  if (sharedOverflowBookings >= MAX_SHARED_OVERFLOW_BOOKINGS) {
    return {
      date,
      decision: "unavailable",
      reason: "shared_booking_limit_reached",
      message:
        "The additional shared-booking allowance has already been used for this date.",
      availabilityConfigured: true,
      totalSpaces: availability.total_spaces,
      spacesAvailable: availability.spaces_available,
      confirmedBookings: dateBookings.length,
      sharedOverflowBookings,
    };
  }

  return {
    date,
    decision: "available",
    reason: "compatible_shared_booking_available",
    message:
      "The configured space is occupied, but one additional compatible booking can be accommodated.",
    availabilityConfigured: true,
    totalSpaces: availability.total_spaces,
    spacesAvailable: availability.spaces_available,
    confirmedBookings: dateBookings.length,
    sharedOverflowBookings,
  };
}

export function evaluateAvailabilityRange({
  occupiedDates,
  availabilityRecords,
  existingBookings,
  request,
}: {
  occupiedDates: string[];
  availabilityRecords: AvailabilityRecord[];
  existingBookings: ExistingOccupancyBooking[];
  request: RequestedOccupancy;
}): AvailabilityRangeEvaluation {
  const availabilityByDate = new Map(
    availabilityRecords.map((record) => [record.date, record]),
  );

  const evaluations = occupiedDates.map((date) =>
    evaluateAvailabilityDate({
      date,
      availability: availabilityByDate.get(date) || null,
      existingBookings,
      request,
    }),
  );

  const unavailableDates = evaluations
    .filter((evaluation) => evaluation.decision === "unavailable")
    .map((evaluation) => evaluation.date);

  const unconfiguredDates = evaluations
    .filter((evaluation) => evaluation.reason === "unconfigured_date")
    .map((evaluation) => evaluation.date);

  const sharedDates = evaluations
    .filter(
      (evaluation) =>
        evaluation.reason === "compatible_shared_booking_available",
    )
    .map((evaluation) => evaluation.date);

  if (unavailableDates.length > 0) {
    const firstUnavailableEvaluation = evaluations.find(
      (evaluation) => evaluation.decision === "unavailable",
    );

    return {
      decision: "unavailable",
      availabilityConfirmationRequired: false,
      canSubmitPendingBooking: false,
      canConfirmBooking: false,
      unconfiguredDates,
      unavailableDates,
      sharedDates,
      evaluations,
      warning: null,
      error:
        firstUnavailableEvaluation?.message ||
        "The selected dates cannot currently accommodate this booking.",
    };
  }

  if (unconfiguredDates.length > 0) {
    return {
      decision: "availability_review_required",
      availabilityConfirmationRequired: true,
      canSubmitPendingBooking: true,
      canConfirmBooking: false,
      unconfiguredDates,
      unavailableDates: [],
      sharedDates,
      evaluations,
      warning: formatUnconfiguredAvailabilityWarning(unconfiguredDates),
      error: null,
    };
  }

  return {
    decision: "available",
    availabilityConfirmationRequired: false,
    canSubmitPendingBooking: true,
    canConfirmBooking: true,
    unconfiguredDates: [],
    unavailableDates: [],
    sharedDates,
    evaluations,
    warning:
      sharedDates.length > 0
        ? "This booking uses the additional compatible shared-booking allowance."
        : null,
    error: null,
  };
}
