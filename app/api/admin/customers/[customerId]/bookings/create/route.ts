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

type RouteContext = {
  params: Promise<{
    customerId: string;
  }>;
};

type CreateAdminBookingRequest = {
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
    error instanceof Error ? error.message : "Unable to create the booking.";

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

export async function POST(request: Request, context: RouteContext) {
  try {
    const { customerId } = await context.params;

    if (!customerId?.trim()) {
      return NextResponse.json(
        {
          error: "Customer ID is missing.",
        },
        {
          status: 400,
        },
      );
    }

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
          error: "You do not have permission to create customer bookings.",
        },
        {
          status: 403,
        },
      );
    }

    const { data: customer, error: customerLoadError } = await supabaseAdmin
      .from("profiles")
      .select(
        `
          id,
          active,
          is_admin
          `,
      )
      .eq("id", customerId)
      .maybeSingle();

    if (customerLoadError) {
      return NextResponse.json(
        {
          error: customerLoadError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!customer) {
      return NextResponse.json(
        {
          error: "The customer could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    if (customer.is_admin === true) {
      return NextResponse.json(
        {
          error:
            "Bookings cannot be created through the customer workflow for an administrator profile.",
        },
        {
          status: 409,
        },
      );
    }

    if (!customer.active) {
      return NextResponse.json(
        {
          error: "A booking cannot be created for an inactive customer.",
        },
        {
          status: 409,
        },
      );
    }

    let body: CreateAdminBookingRequest;

    try {
      body = (await request.json()) as CreateAdminBookingRequest;
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

    const { data: dog, error: dogLoadError } = await supabaseAdmin
      .from("dogs")
      .select(
        `
          id,
          owner_id,
          active,
          can_share_with_other_dogs
          `,
      )
      .eq("id", dogId)
      .eq("owner_id", customer.id)
      .maybeSingle();

    if (dogLoadError) {
      return NextResponse.json(
        {
          error: dogLoadError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!dog) {
      return NextResponse.json(
        {
          error: "The selected dog could not be found for this customer.",
        },
        {
          status: 404,
        },
      );
    }

    if (!dog.active) {
      return NextResponse.json(
        {
          error: "A booking cannot be created for an inactive dog.",
        },
        {
          status: 409,
        },
      );
    }

    let creationResult;

    try {
      creationResult = await createPendingBookingV2({
        supabase: supabaseAdmin,
        input: {
          ownerId: customer.id,
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
          : "Unable to create the booking.";

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
        message: warning || "The booking was created as Pending.",
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Administrator V2 booking creation failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create the booking.",
      },
      {
        status: 500,
      },
    );
  }
}
