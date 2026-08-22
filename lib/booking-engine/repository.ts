import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { BookingType, DaycareSessionType } from "@/types/booking";
import type {
  BookingEngineDog,
  ValidatedBookingEngineRequest,
} from "@/lib/booking-engine/domain";

import { ACTIVE_BOOKING_STATUSES } from "@/types/booking";

export type BookingEngineAvailabilityRecord = {
  id: string;
  date: string;
  available: boolean;
  total_spaces: number;
  spaces_available: number;
  notes: string | null;
};

export type BookingEngineExistingBooking = {
  id: string;
  booking_reference: string;
  owner_id: string;
  booking_type: BookingType;
  daycare_session: DaycareSessionType | null;
  start_date: string;
  end_date: string;
  status: string;
  space_units: number;
  booking_dogs: Array<{
    dog_id: string;
  }>;
};

export type PendingBookingInsert = {
  ownerId: string;
  primaryDogId: string;
  dogIds: string[];
  bookingType: BookingType;
  daycareSession: DaycareSessionType | null;
  startDate: string;
  endDate: string;
  notes: string | null;
  availabilityConfirmationRequired: boolean;
  spaceUnits: number;
};

export type CreatedPendingBooking = {
  id: string;
  booking_reference: string;
  owner_id: string;
  dog_id: string;
  booking_type: BookingType;
  daycare_session: DaycareSessionType | null;
  start_date: string;
  end_date: string;
  status: "Pending";
  notes: string | null;
  availability_confirmation_required: boolean;
  availability_confirmed_at: string | null;
  availability_confirmed_by: string | null;
  space_units: number;
  created_at: string;
};

function normaliseNotes(notes: string | null | undefined) {
  const normalisedNotes = notes?.trim() || "";

  return normalisedNotes || null;
}

export async function loadBookingDogs({
  supabase,
  ownerId,
  dogIds,
}: {
  supabase: SupabaseClient;
  ownerId: string;
  dogIds: string[];
}): Promise<BookingEngineDog[]> {
  if (dogIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("dogs")
    .select(
      `
      id,
      owner_id,
      active,
      can_share_with_other_dogs
      `,
    )
    .eq("owner_id", ownerId)
    .in("id", dogIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((dog) => ({
    id: String(dog.id),
    owner_id: String(dog.owner_id),
    active: Boolean(dog.active),
    can_share_with_other_dogs: dog.can_share_with_other_dogs !== false,
  }));
}

export async function loadAvailabilityForDates({
  supabase,
  occupiedDates,
}: {
  supabase: SupabaseClient;
  occupiedDates: string[];
}): Promise<BookingEngineAvailabilityRecord[]> {
  if (occupiedDates.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("availability")
    .select(
      `
      id,
      date,
      available,
      total_spaces,
      spaces_available,
      notes
      `,
    )
    .in("date", occupiedDates)
    .order("date", {
      ascending: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((availabilityRecord) => ({
    id: String(availabilityRecord.id),
    date: String(availabilityRecord.date),
    available: Boolean(availabilityRecord.available),
    total_spaces: Number(availabilityRecord.total_spaces),
    spaces_available: Number(availabilityRecord.spaces_available),
    notes:
      typeof availabilityRecord.notes === "string"
        ? availabilityRecord.notes
        : null,
  }));
}

export async function loadOverlappingActiveBookings({
  supabase,
  dogIds,
  startDate,
  endDate,
}: {
  supabase: SupabaseClient;
  dogIds: string[];
  startDate: string;
  endDate: string;
}): Promise<BookingEngineExistingBooking[]> {
  if (dogIds.length === 0) {
    return [];
  }

  const { data: bookingDogRows, error: bookingDogError } = await supabase
    .from("booking_dogs")
    .select("booking_id, dog_id")
    .in("dog_id", dogIds);

  if (bookingDogError) {
    throw new Error(bookingDogError.message);
  }

  const bookingIds = Array.from(
    new Set((bookingDogRows || []).map((row) => String(row.booking_id))),
  );

  if (bookingIds.length === 0) {
    return [];
  }

  const { data: bookingRows, error: bookingError } = await supabase
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
        space_units
        `,
    )
    .in("id", bookingIds)
    .in("status", ACTIVE_BOOKING_STATUSES)
    .lte("start_date", endDate)
    .gte("end_date", startDate);

  if (bookingError) {
    throw new Error(bookingError.message);
  }

  const dogLinksByBookingId = new Map<string, Array<{ dog_id: string }>>();

  for (const bookingDogRow of bookingDogRows || []) {
    const bookingId = String(bookingDogRow.booking_id);
    const currentLinks = dogLinksByBookingId.get(bookingId) || [];

    currentLinks.push({
      dog_id: String(bookingDogRow.dog_id),
    });

    dogLinksByBookingId.set(bookingId, currentLinks);
  }

  return (bookingRows || []).map((booking) => ({
    id: String(booking.id),
    booking_reference: String(booking.booking_reference),
    owner_id: String(booking.owner_id),
    booking_type: booking.booking_type as BookingType,
    daycare_session: booking.daycare_session as DaycareSessionType | null,
    start_date: String(booking.start_date),
    end_date: String(booking.end_date),
    status: String(booking.status),
    space_units: Number(booking.space_units),
    booking_dogs: dogLinksByBookingId.get(String(booking.id)) || [],
  }));
}

export function findSelectedDogOverlap({
  existingBookings,
  selectedDogIds,
}: {
  existingBookings: BookingEngineExistingBooking[];
  selectedDogIds: string[];
}) {
  const selectedDogIdSet = new Set(selectedDogIds);

  return (
    existingBookings.find((booking) =>
      booking.booking_dogs.some((bookingDog) =>
        selectedDogIdSet.has(bookingDog.dog_id),
      ),
    ) || null
  );
}

export function getUnconfiguredAvailabilityDates({
  occupiedDates,
  availabilityRecords,
}: {
  occupiedDates: string[];
  availabilityRecords: BookingEngineAvailabilityRecord[];
}) {
  const configuredDateSet = new Set(
    availabilityRecords.map((record) => record.date),
  );

  return occupiedDates.filter((date) => !configuredDateSet.has(date));
}

export function buildPendingBookingInsert({
  request,
  notes,
  availabilityConfirmationRequired,
}: {
  request: ValidatedBookingEngineRequest;
  notes?: string | null;
  availabilityConfirmationRequired: boolean;
}): PendingBookingInsert {
  return {
    ownerId: request.ownerId,
    primaryDogId: request.primaryDogId,
    dogIds: request.dogIds,
    bookingType: request.bookingType,
    daycareSession: request.daycareSession,
    startDate: request.startDate,
    endDate: request.endDate,
    notes: normaliseNotes(notes),
    availabilityConfirmationRequired,
    spaceUnits: request.spaceUnits,
  };
}

export async function createPendingBookingWithDogs({
  supabase,
  booking,
}: {
  supabase: SupabaseClient;
  booking: PendingBookingInsert;
}): Promise<CreatedPendingBooking> {
  const { data: creationRows, error: creationError } = await supabase.rpc(
    "create_pending_booking_v2_atomic",
    {
      p_owner_id: booking.ownerId,
      p_dog_ids: booking.dogIds,
      p_booking_type: booking.bookingType,
      p_daycare_session: booking.daycareSession,
      p_start_date: booking.startDate,
      p_end_date: booking.endDate,
      p_notes: booking.notes,
      p_availability_confirmation_required:
        booking.availabilityConfirmationRequired,
      p_space_units: booking.spaceUnits,
    },
  );

  if (creationError) {
    const errorMessage =
      creationError.message || "The pending booking could not be created.";

    if (errorMessage.includes("BOOKING_OWNER_REQUIRED")) {
      throw new Error("The booking customer is missing.");
    }

    if (errorMessage.includes("BOOKING_DOGS_REQUIRED")) {
      throw new Error("At least one dog must be selected for the booking.");
    }

    if (errorMessage.includes("BOOKING_DOG_LIMIT_EXCEEDED")) {
      throw new Error("A booking can include no more than two dogs.");
    }

    if (errorMessage.includes("DUPLICATE_BOOKING_DOG")) {
      throw new Error("The same dog cannot be selected more than once.");
    }

    if (errorMessage.includes("INVALID_BOOKING_DOG")) {
      throw new Error(
        "Every selected dog must be active and belong to the booking customer.",
      );
    }

    if (errorMessage.includes("BOARDING_DAYCARE_SESSION_NOT_ALLOWED")) {
      throw new Error(
        "A daycare session cannot be selected for a boarding booking.",
      );
    }

    if (errorMessage.includes("DAYCARE_SESSION_REQUIRED")) {
      throw new Error("Please select a full-day or half-day daycare session.");
    }

    if (errorMessage.includes("INVALID_BOARDING_DATES")) {
      throw new Error("A boarding booking must end after its start date.");
    }

    if (errorMessage.includes("INVALID_DAYCARE_DATES")) {
      throw new Error("A daycare booking must start and end on the same date.");
    }

    if (errorMessage.includes("BOOKING_START_DATE_IN_PAST")) {
      throw new Error("The booking start date cannot be in the past.");
    }

    if (errorMessage.includes("INVALID_SPACE_UNITS")) {
      throw new Error("The booking contains an invalid space requirement.");
    }

    if (errorMessage.includes("BOOKING_NOTES_TOO_LONG")) {
      throw new Error("Booking notes must not exceed 2,000 characters.");
    }

    throw new Error(errorMessage);
  }

  const creationResult = Array.isArray(creationRows)
    ? creationRows[0]
    : creationRows;

  if (!creationResult) {
    throw new Error(
      "The booking was created without returning a booking result.",
    );
  }

  if (creationResult.booking_status !== "Pending") {
    throw new Error(
      "The new booking did not return the expected Pending status.",
    );
  }

  return {
    id: String(creationResult.booking_id),
    booking_reference: String(creationResult.booking_reference),
    owner_id: String(creationResult.owner_id),
    dog_id: String(creationResult.primary_dog_id),
    booking_type: creationResult.booking_type as BookingType,
    daycare_session:
      creationResult.daycare_session as DaycareSessionType | null,
    start_date: String(creationResult.start_date),
    end_date: String(creationResult.end_date),
    status: "Pending",
    notes:
      typeof creationResult.booking_notes === "string"
        ? creationResult.booking_notes
        : null,
    availability_confirmation_required: Boolean(
      creationResult.availability_confirmation_required,
    ),
    availability_confirmed_at:
      typeof creationResult.availability_confirmed_at === "string"
        ? creationResult.availability_confirmed_at
        : null,
    availability_confirmed_by:
      typeof creationResult.availability_confirmed_by === "string"
        ? creationResult.availability_confirmed_by
        : null,
    space_units: Number(creationResult.space_units),
    created_at: String(creationResult.created_at),
  };
}
