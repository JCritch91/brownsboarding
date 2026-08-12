import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { updateGoogleBookingEvent } from "@/lib/google-calendar";

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
        {
          error: "Required booking calendar information is missing.",
        },
        {
          status: 400,
        }
      );
    }

    const { data: calendarEvent, error: calendarEventError } =
      await supabaseAdmin
        .from("google_calendar_events")
        .select("id, google_event_id")
        .eq("booking_id", bookingId)
        .maybeSingle();

    if (calendarEventError) {
      return NextResponse.json(
        {
          error: calendarEventError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!calendarEvent) {
      return NextResponse.json(
        {
          error: "No Google Calendar event exists for this booking.",
        },
        {
          status: 404,
        }
      );
    }

    const updatedEvent = await updateGoogleBookingEvent(
      calendarEvent.google_event_id,
      {
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
      }
    );

    const { error: updateTrackingError } = await supabaseAdmin
      .from("google_calendar_events")
      .update({
        google_event_link: updatedEvent.htmlLink || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", calendarEvent.id);

    if (updateTrackingError) {
      return NextResponse.json(
        {
          error: `Google Calendar was updated, but the tracking record could not be updated: ${updateTrackingError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      eventId: updatedEvent.id,
      eventLink: updatedEvent.htmlLink,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unable to update Google Calendar event.";

    console.error("Google Calendar update route failed:", error);

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