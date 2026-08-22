import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getBookingOccupiedDates,
  validateBookingDogs,
  validateBookingEngineRequest,
  type BookingEngineRequest,
} from "@/lib/booking-engine/domain";

import {
  buildPendingBookingInsert,
  createPendingBookingWithDogs,
  findSelectedDogOverlap,
  loadAvailabilityForDates,
  loadBookingDogs,
  loadOverlappingActiveBookings,
  type BookingEngineExistingBooking,
  type CreatedPendingBooking,
} from "@/lib/booking-engine/repository";

import {
  evaluateAvailabilityRange,
  type AvailabilityRangeEvaluation,
  type ExistingOccupancyBooking,
} from "@/lib/booking-engine/availability-engine";

export type CreatePendingBookingV2Input = {
  ownerId: string;
  dogIds: string[];
  bookingType: unknown;
  daycareSession: unknown;
  startDate: string;
  endDate: string;
  notes?: string | null;
};

export type CreatePendingBookingV2Result = {
  booking: CreatedPendingBooking;
  availability: AvailabilityRangeEvaluation;
  warning: string | null;
};

function normaliseNotes(notes: string | null | undefined) {
  return typeof notes === "string" ? notes.trim() : "";
}

function datesOverlap(
  firstDates: readonly string[],
  secondDates: readonly string[],
) {
  const firstDateSet = new Set(firstDates);

  return secondDates.some((date) => firstDateSet.has(date));
}

function getExistingBookingOccupiedDates(
  booking: BookingEngineExistingBooking,
) {
  return getBookingOccupiedDates({
    bookingType: booking.booking_type,
    startDate: booking.start_date,
    endDate: booking.end_date,
  });
}

function filterBookingsOccupyingRequestedDates({
  bookings,
  requestedOccupiedDates,
}: {
  bookings: BookingEngineExistingBooking[];
  requestedOccupiedDates: string[];
}) {
  return bookings.filter((booking) =>
    datesOverlap(
      getExistingBookingOccupiedDates(booking),
      requestedOccupiedDates,
    ),
  );
}

function findSelectedDogDateOverlap({
  existingBookings,
  selectedDogIds,
  requestedOccupiedDates,
}: {
  existingBookings: BookingEngineExistingBooking[];
  selectedDogIds: string[];
  requestedOccupiedDates: string[];
}) {
  const bookingsOccupyingRequestedDates = filterBookingsOccupyingRequestedDates(
    {
      bookings: existingBookings,
      requestedOccupiedDates,
    },
  );

  return findSelectedDogOverlap({
    existingBookings: bookingsOccupyingRequestedDates,
    selectedDogIds,
  });
}

async function loadExistingOccupancyDogs({
  supabase,
  bookings,
}: {
  supabase: SupabaseClient;
  bookings: BookingEngineExistingBooking[];
}) {
  const existingDogIds = Array.from(
    new Set(
      bookings.flatMap((booking) =>
        booking.booking_dogs.map((bookingDog) => bookingDog.dog_id),
      ),
    ),
  );

  if (existingDogIds.length === 0) {
    return new Map<
      string,
      {
        id: string;
        owner_id: string;
        can_share_with_other_dogs: boolean;
      }
    >();
  }

  const { data, error } = await supabase
    .from("dogs")
    .select(
      `
      id,
      owner_id,
      can_share_with_other_dogs
      `,
    )
    .in("id", existingDogIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    (data || []).map((dog) => [
      String(dog.id),
      {
        id: String(dog.id),
        owner_id: String(dog.owner_id),
        can_share_with_other_dogs: dog.can_share_with_other_dogs !== false,
      },
    ]),
  );
}

async function buildExistingOccupancyBookings({
  supabase,
  bookings,
}: {
  supabase: SupabaseClient;
  bookings: BookingEngineExistingBooking[];
}): Promise<ExistingOccupancyBooking[]> {
  const dogById = await loadExistingOccupancyDogs({
    supabase,
    bookings,
  });

  return bookings.map((booking) => ({
    id: booking.id,
    owner_id: booking.owner_id,
    booking_type: booking.booking_type,
    daycare_session: booking.daycare_session,
    start_date: booking.start_date,
    end_date: booking.end_date,
    space_units: Math.max(1, booking.space_units),
    dogs: booking.booking_dogs
      .map((bookingDog) => dogById.get(bookingDog.dog_id))
      .filter(
        (
          dog,
        ): dog is {
          id: string;
          owner_id: string;
          can_share_with_other_dogs: boolean;
        } => Boolean(dog),
      ),
  }));
}

export async function createPendingBookingV2({
  supabase,
  input,
}: {
  supabase: SupabaseClient;
  input: CreatePendingBookingV2Input;
}): Promise<CreatePendingBookingV2Result> {
  const notes = normaliseNotes(input.notes);

  if (notes.length > 2000) {
    throw new Error("Booking notes must not exceed 2,000 characters.");
  }

  const requestValidation = validateBookingEngineRequest({
    ownerId: input.ownerId,
    dogIds: input.dogIds,
    bookingType: input.bookingType,
    daycareSession: input.daycareSession,
    startDate: input.startDate,
    endDate: input.endDate,
  } as BookingEngineRequest);

  if (!requestValidation.valid) {
    throw new Error(requestValidation.error);
  }

  const request = requestValidation.request;

  const selectedDogs = await loadBookingDogs({
    supabase,
    ownerId: request.ownerId,
    dogIds: request.dogIds,
  });

  const dogValidation = validateBookingDogs({
    dogs: selectedDogs,
    ownerId: request.ownerId,
    selectedDogIds: request.dogIds,
  });

  if (!dogValidation.valid) {
    throw new Error(dogValidation.error);
  }

  const existingBookingCandidates = await loadOverlappingActiveBookings({
    supabase,
    dogIds: request.dogIds,
    startDate: request.startDate,
    endDate: request.endDate,
  });

  const selectedDogOverlap = findSelectedDogDateOverlap({
    existingBookings: existingBookingCandidates,
    selectedDogIds: request.dogIds,
    requestedOccupiedDates: request.occupiedDates,
  });

  if (selectedDogOverlap) {
    throw new Error(
      `One or more selected dogs already have an active booking that overlaps with booking ${selectedDogOverlap.booking_reference}.`,
    );
  }

  const availabilityRecords = await loadAvailabilityForDates({
    supabase,
    occupiedDates: request.occupiedDates,
  });

  /*
   * The selected-dog overlap query returns bookings linked
   * to those dogs only. Availability evaluation needs every
   * active booking occupying the requested dates, including
   * bookings belonging to other households.
   */
  const { data: activeBookingRows, error: activeBookingError } = await supabase
    .from("bookings")
    .select(
      `
        id,
        booking_reference,
        owner_id,
        booking_type,
        daycare_session,
        start_date,
        end_date,
        status,
        space_units,
        booking_dogs (
          dog_id
        )
        `,
    )
    .in("status", ["Deposit Pending", "Balance Pending", "Balance Paid"])
    .lte("start_date", request.endDate)
    .gte("end_date", request.startDate);

  if (activeBookingError) {
    throw new Error(activeBookingError.message);
  }

  const existingOccupancyCandidates = (activeBookingRows || []).map(
    (booking) => ({
      id: String(booking.id),
      booking_reference: String(booking.booking_reference),
      owner_id: String(booking.owner_id),
      booking_type:
        booking.booking_type as BookingEngineExistingBooking["booking_type"],
      daycare_session:
        booking.daycare_session as BookingEngineExistingBooking["daycare_session"],
      start_date: String(booking.start_date),
      end_date: String(booking.end_date),
      status: String(booking.status),
      space_units: Number(booking.space_units),
      booking_dogs: (Array.isArray(booking.booking_dogs)
        ? booking.booking_dogs
        : []
      ).map((bookingDog) => ({
        dog_id: String(bookingDog.dog_id),
      })),
    }),
  );

  const existingOccupancyBookings = filterBookingsOccupyingRequestedDates({
    bookings: existingOccupancyCandidates,
    requestedOccupiedDates: request.occupiedDates,
  });

  const availabilityOccupancy = await buildExistingOccupancyBookings({
    supabase,
    bookings: existingOccupancyBookings,
  });

  const availabilityEvaluation = evaluateAvailabilityRange({
    occupiedDates: request.occupiedDates,
    availabilityRecords,
    existingBookings: availabilityOccupancy,
    request: {
      ownerId: request.ownerId,
      bookingType: request.bookingType,
      daycareSession: request.daycareSession,
      dogIds: request.dogIds,
      canShareWithOtherHouseholds: dogValidation.canShareWithOtherHouseholds,
      spaceUnits: request.spaceUnits,
    },
  });

  if (!availabilityEvaluation.canSubmitPendingBooking) {
    throw new Error(
      availabilityEvaluation.error ||
        "The selected dates cannot accommodate this booking.",
    );
  }

  const pendingBooking = buildPendingBookingInsert({
    request,
    notes,
    availabilityConfirmationRequired:
      availabilityEvaluation.availabilityConfirmationRequired,
  });

  const booking = await createPendingBookingWithDogs({
    supabase,
    booking: pendingBooking,
  });

  return {
    booking,
    availability: availabilityEvaluation,
    warning: availabilityEvaluation.warning,
  };
}
