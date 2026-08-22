import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { createPendingBookingV2 } from "@/lib/booking-engine/service";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

type CreateCustomerBookingRequest = {
  dogId?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  notes?: unknown;
};

function optionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getBookingCreationStatus(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Unable to create the booking request.";

  if (
    message.includes("already have an active booking") ||
    message.includes("cannot currently accommodate") ||
    message.includes("has been marked as unavailable") ||
    message.includes("cannot share") ||
    message.includes("shared-booking allowance")
  ) {
    return 409;
  }

  if (
    message.includes("Please select") ||
    message.includes("must contain") ||
    message.includes("must end") ||
    message.includes("cannot be in the past") ||
    message.includes("must not exceed") ||
    message.includes("booking customer is missing") ||
    message.includes("must belong") ||
    message.includes("inactive")
  ) {
    return 400;
  }

  return 500;
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
          error: "You must be signed in to request a booking.",
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

    const { data: profile, error: profileError } = await supabaseAdmin
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

    if (profileError) {
      return NextResponse.json(
        {
          error: profileError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          error: "Your customer account could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    if (profile.is_admin === true) {
      return NextResponse.json(
        {
          error:
            "Administrator accounts cannot use the customer booking request workflow.",
        },
        {
          status: 403,
        },
      );
    }

    if (!profile.active) {
      return NextResponse.json(
        {
          error: "A booking cannot be requested from an inactive account.",
        },
        {
          status: 403,
        },
      );
    }

    let body: CreateCustomerBookingRequest;

    try {
      body = (await request.json()) as CreateCustomerBookingRequest;
    } catch {
      return NextResponse.json(
        {
          error: "The booking request body is invalid.",
        },
        {
          status: 400,
        },
      );
    }

    const dogId = optionalString(body.dogId);
    const startDate = optionalString(body.startDate);
    const endDate = optionalString(body.endDate);
    const notes = optionalString(body.notes);

    if (!dogId) {
      return NextResponse.json(
        {
          error: "Please select a dog.",
        },
        {
          status: 400,
        },
      );
    }

    if (notes.length > 2000) {
      return NextResponse.json(
        {
          error: "Booking notes must not exceed 2,000 characters.",
        },
        {
          status: 400,
        },
      );
    }

    const { data: dog, error: dogError } = await supabaseAdmin
      .from("dogs")
      .select(
        `
          id,
          owner_id,
          name,
          active,
          vaccinated,
          vaccination_expiry,
          can_share_with_other_dogs
          `,
      )
      .eq("id", dogId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (dogError) {
      return NextResponse.json(
        {
          error: dogError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!dog) {
      return NextResponse.json(
        {
          error: "The selected dog could not be found on your account.",
        },
        {
          status: 404,
        },
      );
    }

    if (!dog.active) {
      return NextResponse.json(
        {
          error: "An inactive dog cannot be included in a booking request.",
        },
        {
          status: 400,
        },
      );
    }

    if (!dog.vaccinated) {
      return NextResponse.json(
        {
          error: "The selected dog's vaccination information is incomplete.",
        },
        {
          status: 400,
        },
      );
    }

    if (!dog.vaccination_expiry) {
      return NextResponse.json(
        {
          error: "The selected dog's vaccination expiry date is missing.",
        },
        {
          status: 400,
        },
      );
    }

    if (startDate && dog.vaccination_expiry < startDate) {
      return NextResponse.json(
        {
          error:
            "The selected dog's vaccination will have expired before the booking begins.",
        },
        {
          status: 400,
        },
      );
    }

    let creationResult;

    try {
      creationResult = await createPendingBookingV2({
        supabase: supabaseAdmin,
        input: {
          ownerId: user.id,
          dogIds: [dog.id],
          bookingType: "boarding",
          daycareSession: null,
          startDate,
          endDate,
          notes,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to create the booking request.";

      return NextResponse.json(
        {
          error: message,
        },
        {
          status: getBookingCreationStatus(error),
        },
      );
    }

    const { booking, availability, warning } = creationResult;

    return NextResponse.json(
      {
        success: true,
        bookingCreated: true,
        booking: {
          id: booking.id,
          bookingReference: booking.booking_reference,
          ownerId: booking.owner_id,
          dogId: booking.dog_id,
          dogIds: [booking.dog_id],
          bookingType: booking.booking_type,
          daycareSession: booking.daycare_session,
          startDate: booking.start_date,
          endDate: booking.end_date,
          status: booking.status,
          notes: booking.notes,
          spaceUnits: booking.space_units,
          availabilityConfirmationRequired:
            booking.availability_confirmation_required,
          createdAt: booking.created_at,
        },
        availability: {
          decision: availability.decision,
          confirmationRequired: availability.availabilityConfirmationRequired,
          unconfiguredDates: availability.unconfiguredDates,
          sharedDates: availability.sharedDates,
        },
        warning,
        message:
          warning ||
          "Your booking request has been submitted successfully and is awaiting review.",
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Customer V2 booking creation failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create the booking request.",
      },
      {
        status: 500,
      },
    );
  }
}
