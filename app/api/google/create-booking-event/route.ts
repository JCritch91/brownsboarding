import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { createGoogleBookingEvent } from "@/lib/google-calendar";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      bookingId,
      bookingReference,
      ownerName,
      ownerEmail,
      dogName,
      dogBreed,
      startDate,
      endDate,
      bookingStatus,
      paymentStatus,
      totalCost,
      depositAmount,
      balanceAmount,
      notes,
    } = body;

if (
      !bookingId ||
      !bookingReference ||
      !ownerName ||
      !dogName ||
      !startDate ||
      !endDate ||
      !bookingStatus ||
      !paymentStatus
    ) {
      return NextResponse.json(
        { error: "Required booking calendar information is missing." },
        { status: 400 }
      );
    }

    const { data: existingEvent, error: existingEventError } =
      await supabaseAdmin
        .from("google_calendar_events")
        .select("google_event_id, google_event_link")
        .eq("booking_id", bookingId)
        .maybeSingle();

    if (existingEventError) {
      return NextResponse.json(
        { error: existingEventError.message },
        { status: 500 }
      );
    }

    if (existingEvent) {
      return NextResponse.json({
        success: true,
        message: "Google Calendar event already exists.",
        eventId: existingEvent.google_event_id,
        eventLink: existingEvent.google_event_link,
      });
    }

    const event = await createGoogleBookingEvent({
      bookingId,
      bookingReference,
      ownerName,
      ownerEmail,
      dogName,
      dogBreed,
      startDate,
      endDate,
      bookingStatus,
      paymentStatus,
      totalCost,
      depositAmount,
      balanceAmount,
      notes,
    });

    const { error: saveError } = await supabaseAdmin
      .from("google_calendar_events")
      .insert({
        booking_id: bookingId,
        google_event_id: event.id,
        google_event_link: event.htmlLink || null,
        updated_at: new Date().toISOString(),
      });

    if (saveError) {
      return NextResponse.json(
        {
          error: `Calendar event created, but its ID could not be saved: ${saveError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      eventId: event.id,
      eventLink: event.htmlLink,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unable to create Google Calendar event.";

    console.error("Google Calendar route failed:", error);

    return NextResponse.json(
      {
        error: errorMessage,
      },
      {
        status: 500,
      }
    );
  }
}