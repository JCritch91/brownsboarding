import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getDatesInRange } from "@/lib/helpers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type SaveBulkAvailabilityRequest = {
  startDate?: unknown;
  endDate?: unknown;
  available?: unknown;
  totalSpaces?: unknown;
  spacesAvailable?: unknown;
  notes?: unknown;
};

type CalendarFailure = {
  date: string;
  error: string;
};

function isValidDatabaseDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function isValidNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

async function getResponseError(response: Response, fallbackMessage: string) {
  const responseText = await response.text();

  if (!responseText) {
    return fallbackMessage;
  }

  try {
    const responseData = JSON.parse(responseText) as {
      error?: unknown;
    };

    return typeof responseData.error === "string"
      ? responseData.error
      : fallbackMessage;
  } catch {
    return responseText;
  }
}

export async function POST(request: Request) {
  try {
    const authorizationHeader = request.headers.get("authorization");

    const accessToken = authorizationHeader?.startsWith("Bearer ")
      ? authorizationHeader.slice(7).trim()
      : "";

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "You must be signed in as an administrator.",
        },
        {
          status: 401,
        },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Unable to verify the signed-in user.",
        },
        {
          status: 401,
        },
      );
    }

    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        active,
        is_admin
        `,
      )
      .eq("id", user.id)
      .maybeSingle();

    if (adminProfileError) {
      return NextResponse.json(
        {
          error: adminProfileError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!adminProfile || !adminProfile.active || !adminProfile.is_admin) {
      return NextResponse.json(
        {
          error: "You do not have permission to amend availability.",
        },
        {
          status: 403,
        },
      );
    }

    let body: SaveBulkAvailabilityRequest;

    try {
      body = (await request.json()) as SaveBulkAvailabilityRequest;
    } catch {
      return NextResponse.json(
        {
          error: "The bulk availability request body is invalid.",
        },
        {
          status: 400,
        },
      );
    }

    if (!isValidDatabaseDate(body.startDate)) {
      return NextResponse.json(
        {
          error: "The start date must be a valid date in YYYY-MM-DD format.",
        },
        {
          status: 400,
        },
      );
    }

    if (!isValidDatabaseDate(body.endDate)) {
      return NextResponse.json(
        {
          error: "The end date must be a valid date in YYYY-MM-DD format.",
        },
        {
          status: 400,
        },
      );
    }

    if (body.endDate < body.startDate) {
      return NextResponse.json(
        {
          error: "End date cannot be before start date.",
        },
        {
          status: 400,
        },
      );
    }

    if (typeof body.available !== "boolean") {
      return NextResponse.json(
        {
          error: "The availability status is invalid.",
        },
        {
          status: 400,
        },
      );
    }

    if (!isValidNonNegativeInteger(body.totalSpaces)) {
      return NextResponse.json(
        {
          error: "Total spaces must be a whole number of zero or greater.",
        },
        {
          status: 400,
        },
      );
    }

    if (!isValidNonNegativeInteger(body.spacesAvailable)) {
      return NextResponse.json(
        {
          error: "Spaces available must be a whole number of zero or greater.",
        },
        {
          status: 400,
        },
      );
    }

    if (body.spacesAvailable > body.totalSpaces) {
      return NextResponse.json(
        {
          error: "Spaces available cannot be higher than total spaces.",
        },
        {
          status: 400,
        },
      );
    }

    if (body.available && body.totalSpaces === 0) {
      return NextResponse.json(
        {
          error: "Available dates must have at least one total space.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !body.available &&
      (body.totalSpaces !== 0 || body.spacesAvailable !== 0)
    ) {
      return NextResponse.json(
        {
          error:
            "Unavailable dates must have zero total spaces and zero spaces available.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      body.notes !== undefined &&
      body.notes !== null &&
      typeof body.notes !== "string"
    ) {
      return NextResponse.json(
        {
          error: "The availability notes are invalid.",
        },
        {
          status: 400,
        },
      );
    }

    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

    if (notes.length > 1000) {
      return NextResponse.json(
        {
          error: "Availability notes must not exceed 1,000 characters.",
        },
        {
          status: 400,
        },
      );
    }

    const dates = getDatesInRange(body.startDate, body.endDate);

    if (dates.length === 0) {
      return NextResponse.json(
        {
          error: "The selected date range does not contain any dates.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Prevent an unexpectedly large request from
     * creating excessive database and calendar work.
     */
    if (dates.length > 366) {
      return NextResponse.json(
        {
          error: "A bulk availability update cannot exceed 366 dates.",
        },
        {
          status: 400,
        },
      );
    }

    const updatedAt = new Date().toISOString();

    const availabilityRows = dates.map((date) => ({
      date,
      available: body.available,
      total_spaces: body.totalSpaces,
      spaces_available: body.spacesAvailable,
      notes: notes || null,
      updated_at: updatedAt,
    }));

    const { data: savedAvailability, error: saveError } = await supabaseAdmin
      .from("availability")
      .upsert(availabilityRows, {
        onConflict: "date",
      })
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
      .order("date", {
        ascending: true,
      });

    if (saveError || !savedAvailability) {
      return NextResponse.json(
        {
          error: saveError?.message || "Unable to update availability.",
        },
        {
          status: 500,
        },
      );
    }

    if (savedAvailability.length !== dates.length) {
      return NextResponse.json(
        {
          error: `The bulk update expected ${dates.length} saved record(s), but the database returned ${savedAvailability.length}.`,
        },
        {
          status: 500,
        },
      );
    }

    const requestOrigin = new URL(request.url).origin;

    /*
     * Each calendar event is independent.
     * Promise.allSettled ensures every saved date is
     * attempted even when one synchronisation fails.
     */
    const calendarResults = await Promise.allSettled(
      savedAvailability.map(async (availabilityRecord) => {
        const calendarResponse = await fetch(
          `${requestOrigin}/api/google/sync-availability-event`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              availabilityId: availabilityRecord.id,
              date: availabilityRecord.date,
              available: availabilityRecord.available,
              totalSpaces: availabilityRecord.total_spaces,
              spacesAvailable: availabilityRecord.spaces_available,
              notes: availabilityRecord.notes,
            }),
          },
        );

        if (!calendarResponse.ok) {
          throw new Error(
            await getResponseError(
              calendarResponse,
              "The Google Calendar event could not be updated.",
            ),
          );
        }

        return {
          date: availabilityRecord.date,
        };
      }),
    );

    const calendarFailures: CalendarFailure[] = [];

    let calendarUpdated = 0;

    calendarResults.forEach((calendarResult, index) => {
      const availabilityRecord = savedAvailability[index];

      if (calendarResult.status === "fulfilled") {
        calendarUpdated += 1;
        return;
      }

      const errorMessage =
        calendarResult.reason instanceof Error
          ? calendarResult.reason.message
          : "Unknown Google Calendar error.";

      calendarFailures.push({
        date: availabilityRecord.date,
        error: errorMessage,
      });

      console.error(
        `Availability calendar sync failed for ${availabilityRecord.date}:`,
        calendarResult.reason,
      );
    });

    const followUpRequired = calendarFailures.length > 0;

    return NextResponse.json(
      {
        success: true,
        availabilitySaved: true,
        followUpRequired,
        requestedDates: dates.length,
        savedDates: savedAvailability.length,
        calendarUpdated,
        calendarFailed: calendarFailures.length,
        calendarFailures,
        availability: savedAvailability.map((availabilityRecord) => ({
          id: availabilityRecord.id,
          date: availabilityRecord.date,
          available: availabilityRecord.available,
          totalSpaces: availabilityRecord.total_spaces,
          spacesAvailable: availabilityRecord.spaces_available,
          notes: availabilityRecord.notes,
        })),
        message: followUpRequired
          ? `Availability was saved for ${savedAvailability.length} date(s), but ${calendarFailures.length} Google Calendar event(s) could not be updated.`
          : `Availability and Google Calendar were updated for ${savedAvailability.length} date(s).`,
      },
      {
        status: followUpRequired ? 207 : 200,
      },
    );
  } catch (error) {
    console.error("Admin bulk availability update failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update availability.",
      },
      {
        status: 500,
      },
    );
  }
}
