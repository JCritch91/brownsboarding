import { createClient } from "@supabase/supabase-js";

import {
  createGoogleAvailabilityEvent,
  updateGoogleAvailabilityEvent,
} from "@/lib/google-availability-calendar";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export type AvailabilityCalendarSyncInput = {
  availabilityId: string;
  date: string;
  available: boolean;
  totalSpaces: number;
  spacesAvailable: number;
  notes: string | null;
};

export type AvailabilityCalendarSyncResult = {
  success: true;
  action: "created" | "updated";
  eventId: string;
  eventLink: string | null;
};

function validateAvailabilityCalendarInput(
  input: AvailabilityCalendarSyncInput,
) {
  if (
    typeof input.availabilityId !== "string" ||
    !input.availabilityId.trim()
  ) {
    throw new Error("Availability ID is missing.");
  }

  if (
    typeof input.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date)
  ) {
    throw new Error("The availability date is invalid.");
  }

  if (typeof input.available !== "boolean") {
    throw new Error("The availability status is invalid.");
  }

  if (
    typeof input.totalSpaces !== "number" ||
    !Number.isInteger(input.totalSpaces) ||
    input.totalSpaces < 0
  ) {
    throw new Error("Total spaces must be a whole number of zero or greater.");
  }

  if (
    typeof input.spacesAvailable !== "number" ||
    !Number.isInteger(input.spacesAvailable) ||
    input.spacesAvailable < 0
  ) {
    throw new Error(
      "Spaces available must be a whole number of zero or greater.",
    );
  }

  if (input.spacesAvailable > input.totalSpaces) {
    throw new Error("Spaces available cannot be higher than total spaces.");
  }

  if (input.notes !== null && typeof input.notes !== "string") {
    throw new Error("Availability notes are invalid.");
  }

  if (typeof input.notes === "string" && input.notes.length > 1000) {
    throw new Error("Availability notes must not exceed 1,000 characters.");
  }
}

export async function syncAvailabilityCalendarEvent(
  input: AvailabilityCalendarSyncInput,
): Promise<AvailabilityCalendarSyncResult> {
  validateAvailabilityCalendarInput(input);

  const availabilityId = input.availabilityId.trim();

  const notes =
    typeof input.notes === "string" ? input.notes.trim() || null : null;

  const { data: existingTrackingRecord, error: trackingLoadError } =
    await supabaseAdmin
      .from("google_availability_calendar_events")
      .select(
        `
      id,
      google_event_id
      `,
      )
      .eq("availability_id", availabilityId)
      .maybeSingle();

  if (trackingLoadError) {
    throw new Error(trackingLoadError.message);
  }

  const availabilityEvent = {
    date: input.date,
    available: input.available,
    totalSpaces: input.totalSpaces,
    spacesAvailable: input.spacesAvailable,
    notes,
  };

  if (existingTrackingRecord) {
    if (!existingTrackingRecord.google_event_id) {
      throw new Error(
        "The Google Calendar tracking record does not contain an event ID.",
      );
    }

    const updatedEvent = await updateGoogleAvailabilityEvent(
      existingTrackingRecord.google_event_id,
      availabilityEvent,
    );

    if (!updatedEvent.id) {
      throw new Error(
        "Google Calendar updated the availability event without returning an event ID.",
      );
    }

    const { error: trackingUpdateError } = await supabaseAdmin
      .from("google_availability_calendar_events")
      .update({
        google_event_id: updatedEvent.id,
        google_event_link: updatedEvent.htmlLink || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingTrackingRecord.id);

    if (trackingUpdateError) {
      throw new Error(
        `Google Calendar was updated, but the tracking record could not be updated: ${trackingUpdateError.message}`,
      );
    }

    return {
      success: true,
      action: "updated",
      eventId: updatedEvent.id,
      eventLink: updatedEvent.htmlLink || null,
    };
  }

  const createdEvent = await createGoogleAvailabilityEvent(availabilityEvent);

  if (!createdEvent.id) {
    throw new Error(
      "Google Calendar created the availability event without returning an event ID.",
    );
  }

  const { error: trackingInsertError } = await supabaseAdmin
    .from("google_availability_calendar_events")
    .insert({
      availability_id: availabilityId,
      google_event_id: createdEvent.id,
      google_event_link: createdEvent.htmlLink || null,
      updated_at: new Date().toISOString(),
    });

  if (trackingInsertError) {
    throw new Error(
      `Google Calendar event was created, but the tracking record could not be saved: ${trackingInsertError.message}`,
    );
  }

  return {
    success: true,
    action: "created",
    eventId: createdEvent.id,
    eventLink: createdEvent.htmlLink || null,
  };
}
