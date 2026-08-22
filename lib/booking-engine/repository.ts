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
    .lt("start_date", endDate)
    .gt("end_date", startDate);

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
  const createdAt = new Date().toISOString();

  const { data: createdBooking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      owner_id: booking.ownerId,
      dog_id: booking.primaryDogId,
      booking_type: booking.bookingType,
      daycare_session: booking.daycareSession,
      start_date: booking.startDate,
      end_date: booking.endDate,
      status: "Pending",
      notes: booking.notes,
      availability_confirmation_required:
        booking.availabilityConfirmationRequired,
      availability_confirmed_at: null,
      availability_confirmed_by: null,
      space_units: booking.spaceUnits,
      updated_at: createdAt,
    })
    .select(
      `
        id,
        booking_reference,
        owner_id,
        dog_id,
        booking_type,
        daycare_session,
        start_date,
        end_date,
        status,
        notes,
        availability_confirmation_required,
        availability_confirmed_at,
        availability_confirmed_by,
        space_units,
        created_at
        `,
    )
    .single();

  if (bookingError || !createdBooking) {
    throw new Error(
      bookingError?.message || "The pending booking could not be created.",
    );
  }

  const bookingDogRows = booking.dogIds.map((dogId, index) => ({
    booking_id: createdBooking.id,
    dog_id: dogId,
    sort_order: index,
  }));

  const { error: bookingDogsError } = await supabase
    .from("booking_dogs")
    .insert(bookingDogRows);

  if (bookingDogsError) {
    /*
     * Creation is not yet atomic across both inserts.
     * Remove the new Pending booking so the repository
     * cannot leave an incomplete booking behind.
     *
     * The database-level atomic function will replace
     * this compensation mechanism in the next step.
     */
    const { error: rollbackError } = await supabase
      .from("bookings")
      .delete()
      .eq("id", createdBooking.id)
      .eq("status", "Pending");

    if (rollbackError) {
      throw new Error(
        `The booking dogs could not be saved: ${bookingDogsError.message}. The incomplete booking could not be removed automatically: ${rollbackError.message}.`,
      );
    }

    throw new Error(
      `The booking dogs could not be saved: ${bookingDogsError.message}.`,
    );
  }

  return {
    ...createdBooking,
    booking_type: createdBooking.booking_type as BookingType,
    daycare_session:
      createdBooking.daycare_session as DaycareSessionType | null,
    status: "Pending",
    notes:
      typeof createdBooking.notes === "string" ? createdBooking.notes : null,
    availability_confirmation_required: Boolean(
      createdBooking.availability_confirmation_required,
    ),
    availability_confirmed_at:
      typeof createdBooking.availability_confirmed_at === "string"
        ? createdBooking.availability_confirmed_at
        : null,
    availability_confirmed_by:
      typeof createdBooking.availability_confirmed_by === "string"
        ? createdBooking.availability_confirmed_by
        : null,
    space_units: Number(createdBooking.space_units),
  };
}
