import { createClient } from "@supabase/supabase-js";

import {
  createGoogleBookingEvent,
  updateGoogleBookingEvent,
} from "@/lib/google-calendar";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export type CreateBookingCalendarEventInput = {
  bookingId: string;
  bookingReference: string;
  ownerName: string;
  ownerEmail?: string | null;
  dogName: string;
  dogBreed?: string | null;
  startDate: string;
  endDate: string;
  bookingStatus: string;
  paymentStatus: string;
  totalCost?: string | null;
  depositAmount?: string | null;
  balanceAmount?: string | null;
  notes?: string | null;
};

export type CreateBookingCalendarEventResult = {
  success: true;
  created: boolean;
  eventId: string;
  eventLink: string | null;
  message: string;
};

export type UpdateBookingCalendarEventResult = {
  success: true;
  updated: true;
  eventId: string;
  eventLink: string | null;
  message: string;
};

function isValidDatabaseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function validateBookingCalendarInput(input: CreateBookingCalendarEventInput) {
  if (typeof input.bookingId !== "string" || !input.bookingId.trim()) {
    throw new Error("Booking ID is missing.");
  }

  if (
    typeof input.bookingReference !== "string" ||
    !input.bookingReference.trim()
  ) {
    throw new Error("Booking reference is missing.");
  }

  if (typeof input.ownerName !== "string" || !input.ownerName.trim()) {
    throw new Error("Owner name is missing.");
  }

  if (typeof input.dogName !== "string" || !input.dogName.trim()) {
    throw new Error("Dog name is missing.");
  }

  if (
    typeof input.startDate !== "string" ||
    !isValidDatabaseDate(input.startDate)
  ) {
    throw new Error("The booking start date is invalid.");
  }

  if (
    typeof input.endDate !== "string" ||
    !isValidDatabaseDate(input.endDate)
  ) {
    throw new Error("The booking end date is invalid.");
  }

  if (input.endDate <= input.startDate) {
    throw new Error("The booking end date must be after the start date.");
  }

  if (typeof input.bookingStatus !== "string" || !input.bookingStatus.trim()) {
    throw new Error("Booking status is missing.");
  }

  if (typeof input.paymentStatus !== "string" || !input.paymentStatus.trim()) {
    throw new Error("Payment status is missing.");
  }

  if (
    input.ownerEmail !== undefined &&
    input.ownerEmail !== null &&
    typeof input.ownerEmail !== "string"
  ) {
    throw new Error("Owner email is invalid.");
  }

  if (
    input.dogBreed !== undefined &&
    input.dogBreed !== null &&
    typeof input.dogBreed !== "string"
  ) {
    throw new Error("Dog breed is invalid.");
  }

  if (
    input.totalCost !== undefined &&
    input.totalCost !== null &&
    typeof input.totalCost !== "string"
  ) {
    throw new Error("Total cost is invalid.");
  }

  if (
    input.depositAmount !== undefined &&
    input.depositAmount !== null &&
    typeof input.depositAmount !== "string"
  ) {
    throw new Error("Deposit amount is invalid.");
  }

  if (
    input.balanceAmount !== undefined &&
    input.balanceAmount !== null &&
    typeof input.balanceAmount !== "string"
  ) {
    throw new Error("Balance amount is invalid.");
  }

  if (
    input.notes !== undefined &&
    input.notes !== null &&
    typeof input.notes !== "string"
  ) {
    throw new Error("Booking notes are invalid.");
  }

  if (typeof input.notes === "string" && input.notes.length > 2000) {
    throw new Error("Booking notes must not exceed 2,000 characters.");
  }
}

export async function createBookingCalendarEvent(
  input: CreateBookingCalendarEventInput,
): Promise<CreateBookingCalendarEventResult> {
  validateBookingCalendarInput(input);

  const bookingId = input.bookingId.trim();

  const { data: existingEvent, error: existingEventError } = await supabaseAdmin
    .from("google_calendar_events")
    .select(
      `
      google_event_id,
      google_event_link
      `,
    )
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (existingEventError) {
    throw new Error(existingEventError.message);
  }

  /*
   * Booking confirmation may be retried after a
   * previous calendar operation completed. Return the
   * existing event instead of creating a duplicate.
   */
  if (existingEvent) {
    if (!existingEvent.google_event_id) {
      throw new Error(
        "The booking calendar tracking record does not contain an event ID.",
      );
    }

    return {
      success: true,
      created: false,
      eventId: existingEvent.google_event_id,
      eventLink: existingEvent.google_event_link || null,
      message: "Google Calendar event already exists.",
    };
  }

  const event = await createGoogleBookingEvent({
    bookingId,
    bookingReference: input.bookingReference.trim(),
    ownerName: input.ownerName.trim(),
    ownerEmail: input.ownerEmail?.trim() || null,
    dogName: input.dogName.trim(),
    dogBreed: input.dogBreed?.trim() || null,
    startDate: input.startDate,
    endDate: input.endDate,
    bookingStatus: input.bookingStatus.trim(),
    paymentStatus: input.paymentStatus.trim(),
    totalCost: input.totalCost?.trim() || null,
    depositAmount: input.depositAmount?.trim() || null,
    balanceAmount: input.balanceAmount?.trim() || null,
    notes: input.notes?.trim() || null,
  });

  if (!event.id) {
    throw new Error(
      "Google Calendar created the booking event without returning an event ID.",
    );
  }

  const { error: saveError } = await supabaseAdmin
    .from("google_calendar_events")
    .insert({
      booking_id: bookingId,
      google_event_id: event.id,
      google_event_link: event.htmlLink || null,
      updated_at: new Date().toISOString(),
    });

  if (saveError) {
    /*
     * Another concurrent confirmation may have created
     * the tracking row after the initial check. Reload
     * it before reporting a failure.
     */
    const { data: concurrentEvent, error: concurrentLoadError } =
      await supabaseAdmin
        .from("google_calendar_events")
        .select(
          `
        google_event_id,
        google_event_link
        `,
        )
        .eq("booking_id", bookingId)
        .maybeSingle();

    if (!concurrentLoadError && concurrentEvent?.google_event_id) {
      return {
        success: true,
        created: false,
        eventId: concurrentEvent.google_event_id,
        eventLink: concurrentEvent.google_event_link || null,
        message: "Google Calendar event already exists.",
      };
    }

    throw new Error(
      `Calendar event was created, but its tracking record could not be saved: ${saveError.message}`,
    );
  }

  return {
    success: true,
    created: true,
    eventId: event.id,
    eventLink: event.htmlLink || null,
    message: "Google Calendar event created successfully.",
  };
}

export async function updateBookingCalendarEvent(
  input: CreateBookingCalendarEventInput,
): Promise<UpdateBookingCalendarEventResult> {
  validateBookingCalendarInput(input);

  const bookingId = input.bookingId.trim();

  const { data: calendarEvent, error: calendarEventError } = await supabaseAdmin
    .from("google_calendar_events")
    .select(
      `
      id,
      google_event_id
      `,
    )
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (calendarEventError) {
    throw new Error(calendarEventError.message);
  }

  if (!calendarEvent) {
    throw new Error("No Google Calendar event exists for this booking.");
  }

  if (!calendarEvent.google_event_id) {
    throw new Error(
      "The booking calendar tracking record does not contain an event ID.",
    );
  }

  const updatedEvent = await updateGoogleBookingEvent(
    calendarEvent.google_event_id,
    {
      bookingId,
      bookingReference: input.bookingReference.trim(),
      ownerName: input.ownerName.trim(),
      ownerEmail: input.ownerEmail?.trim() || null,
      dogName: input.dogName.trim(),
      dogBreed: input.dogBreed?.trim() || null,
      startDate: input.startDate,
      endDate: input.endDate,
      bookingStatus: input.bookingStatus.trim(),
      paymentStatus: input.paymentStatus.trim(),
      totalCost: input.totalCost?.trim() || null,
      depositAmount: input.depositAmount?.trim() || null,
      balanceAmount: input.balanceAmount?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  );

  if (!updatedEvent.id) {
    throw new Error(
      "Google Calendar updated the booking event without returning an event ID.",
    );
  }

  const { error: updateTrackingError } = await supabaseAdmin
    .from("google_calendar_events")
    .update({
      google_event_id: updatedEvent.id,
      google_event_link: updatedEvent.htmlLink || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", calendarEvent.id);

  if (updateTrackingError) {
    throw new Error(
      `Google Calendar was updated, but the tracking record could not be updated: ${updateTrackingError.message}`,
    );
  }

  return {
    success: true,
    updated: true,
    eventId: updatedEvent.id,
    eventLink: updatedEvent.htmlLink || null,
    message: "Google Calendar event updated successfully.",
  };
}
