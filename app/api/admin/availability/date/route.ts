import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type SaveAvailabilityDateRequest = {
  date?: unknown;
  available?: unknown;
  totalSpaces?: unknown;
  spacesAvailable?: unknown;
  notes?: unknown;
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

    let body: SaveAvailabilityDateRequest;

    try {
      body = (await request.json()) as SaveAvailabilityDateRequest;
    } catch {
      return NextResponse.json(
        {
          error: "The availability request body is invalid.",
        },
        {
          status: 400,
        },
      );
    }

    if (!isValidDatabaseDate(body.date)) {
      return NextResponse.json(
        {
          error:
            "The availability date must be a valid date in YYYY-MM-DD format.",
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
          error: "An available date must have at least one total space.",
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
            "An unavailable date must have zero total spaces and zero spaces available.",
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

    const { data: savedAvailability, error: saveError } = await supabaseAdmin
      .from("availability")
      .upsert(
        {
          date: body.date,
          available: body.available,
          total_spaces: body.totalSpaces,
          spaces_available: body.spacesAvailable,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "date",
        },
      )
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
      .single();

    if (saveError || !savedAvailability) {
      return NextResponse.json(
        {
          error: saveError?.message || "Unable to save availability.",
        },
        {
          status: 500,
        },
      );
    }

    const requestOrigin = new URL(request.url).origin;

    let calendarUpdated = false;

    let calendarError: string | null = null;

    try {
      const calendarResponse = await fetch(
        `${requestOrigin}/api/google/sync-availability-event`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            availabilityId: savedAvailability.id,
            date: savedAvailability.date,
            available: savedAvailability.available,
            totalSpaces: savedAvailability.total_spaces,
            spacesAvailable: savedAvailability.spaces_available,
            notes: savedAvailability.notes,
          }),
        },
      );

      if (!calendarResponse.ok) {
        calendarError = await getResponseError(
          calendarResponse,
          "The Google Calendar event could not be updated.",
        );
      } else {
        calendarUpdated = true;
      }
    } catch (error) {
      calendarError =
        error instanceof Error
          ? error.message
          : "Unknown Google Calendar error.";
    }

    if (!calendarUpdated) {
      console.error(
        `Availability calendar sync failed for ${savedAvailability.date}:`,
        calendarError,
      );
    }

    const followUpRequired = !calendarUpdated;

    return NextResponse.json(
      {
        success: true,
        availabilitySaved: true,
        followUpRequired,
        availability: {
          id: savedAvailability.id,
          date: savedAvailability.date,
          available: savedAvailability.available,
          totalSpaces: savedAvailability.total_spaces,
          spacesAvailable: savedAvailability.spaces_available,
          notes: savedAvailability.notes,
        },
        calendar: {
          updated: calendarUpdated,
          error: calendarError,
        },
        message: calendarUpdated
          ? "Availability was saved and Google Calendar was updated successfully."
          : "Availability was saved, but the Google Calendar event could not be updated.",
      },
      {
        status: followUpRequired ? 207 : 200,
      },
    );
  } catch (error) {
    console.error("Admin availability update failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save availability.",
      },
      {
        status: 500,
      },
    );
  }
}
