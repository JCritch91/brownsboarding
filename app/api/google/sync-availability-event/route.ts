import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  createGoogleAvailabilityEvent,
  updateGoogleAvailabilityEvent,
} from "@/lib/google-availability-calendar";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      availabilityId,
      date,
      available,
      totalSpaces,
      spacesAvailable,
      notes,
    } = body;

    const missingFields: string[] = [];

    if (!availabilityId) missingFields.push("availabilityId");
    if (!date) missingFields.push("date");
    if (typeof available !== "boolean") missingFields.push("available");
    if (typeof totalSpaces !== "number") missingFields.push("totalSpaces");
    if (typeof spacesAvailable !== "number") {
      missingFields.push("spacesAvailable");
    }

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: `Required availability information is missing: ${missingFields.join(
            ", "
          )}.`,
        },
        { status: 400 }
      );
    }

    const { data: existingTrackingRecord, error: trackingLoadError } =
      await supabaseAdmin
        .from("google_availability_calendar_events")
        .select("id, google_event_id")
        .eq("availability_id", availabilityId)
        .maybeSingle();

    if (trackingLoadError) {
      return NextResponse.json(
        {
          error: trackingLoadError.message,
        },
        { status: 500 }
      );
    }

    const availabilityEvent = {
      date,
      available,
      totalSpaces,
      spacesAvailable,
      notes: notes || null,
    };

    if (existingTrackingRecord) {
      const updatedEvent = await updateGoogleAvailabilityEvent(
        existingTrackingRecord.google_event_id,
        availabilityEvent
      );

      const { error: trackingUpdateError } = await supabaseAdmin
        .from("google_availability_calendar_events")
        .update({
          google_event_link: updatedEvent.htmlLink || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTrackingRecord.id);

      if (trackingUpdateError) {
        return NextResponse.json(
          {
            error: `Google Calendar was updated, but the tracking record could not be updated: ${trackingUpdateError.message}`,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        action: "updated",
        eventId: updatedEvent.id,
        eventLink: updatedEvent.htmlLink,
      });
    }

    const createdEvent = await createGoogleAvailabilityEvent(
      availabilityEvent
    );

    const { error: trackingInsertError } = await supabaseAdmin
      .from("google_availability_calendar_events")
      .insert({
        availability_id: availabilityId,
        google_event_id: createdEvent.id,
        google_event_link: createdEvent.htmlLink || null,
        updated_at: new Date().toISOString(),
      });

    if (trackingInsertError) {
      return NextResponse.json(
        {
          error: `Google Calendar event was created, but the tracking record could not be saved: ${trackingInsertError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      action: "created",
      eventId: createdEvent.id,
      eventLink: createdEvent.htmlLink,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unable to sync the Google availability event.";

    console.error("Google availability sync failed:", error);

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}