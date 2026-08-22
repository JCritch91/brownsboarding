import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

type ConfirmAvailabilityRequest = {
  bookingId?: unknown;
};

type AvailabilityApprovalResult = {
  booking_id: string;
  booking_reference: string;
  availability_confirmation_required: boolean;
  availability_confirmed_at: string;
  availability_confirmed_by: string;
  created_availability_dates: number;
};

function getApprovalErrorResponse(errorMessage: string) {
  if (errorMessage.includes("BOOKING_ID_REQUIRED")) {
    return {
      error: "Booking ID is missing.",
      status: 400,
    };
  }

  if (errorMessage.includes("ADMIN_USER_ID_REQUIRED")) {
    return {
      error: "The administrator ID is missing.",
      status: 400,
    };
  }

  if (errorMessage.includes("ACTIVE_ADMIN_REQUIRED")) {
    return {
      error: "You do not have permission to confirm booking availability.",
      status: 403,
    };
  }

  if (errorMessage.includes("BOOKING_NOT_FOUND")) {
    return {
      error: "The booking could not be found.",
      status: 404,
    };
  }

  if (errorMessage.includes("BOOKING_NOT_PENDING")) {
    return {
      error: "Availability can only be confirmed while the booking is Pending.",
      status: 409,
    };
  }

  if (errorMessage.includes("AVAILABILITY_CONFIRMATION_NOT_REQUIRED")) {
    return {
      error: "This booking does not require an availability review.",
      status: 409,
    };
  }

  if (errorMessage.includes("AVAILABILITY_EXPLICITLY_UNAVAILABLE")) {
    return {
      error:
        "One or more booking dates have been explicitly marked as unavailable.",
      status: 409,
    };
  }

  if (errorMessage.includes("AVAILABILITY_RECORD_MISSING")) {
    return {
      error: "One or more required availability records could not be created.",
      status: 500,
    };
  }

  if (errorMessage.includes("INVALID_BOARDING_DATES")) {
    return {
      error: "The boarding booking contains invalid start or end dates.",
      status: 400,
    };
  }

  if (errorMessage.includes("INVALID_DAYCARE_DATES")) {
    return {
      error: "The daycare booking must start and end on the same date.",
      status: 400,
    };
  }

  if (errorMessage.includes("INVALID_BOOKING_TYPE")) {
    return {
      error: "The booking type is invalid.",
      status: 400,
    };
  }

  if (errorMessage.includes("NO_OCCUPIED_DATES")) {
    return {
      error: "The booking does not contain any occupied dates.",
      status: 400,
    };
  }

  return {
    error: errorMessage,
    status: 500,
  };
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
          error: "You do not have permission to confirm booking availability.",
        },
        {
          status: 403,
        },
      );
    }

    let body: ConfirmAvailabilityRequest;

    try {
      body = (await request.json()) as ConfirmAvailabilityRequest;
    } catch {
      return NextResponse.json(
        {
          error: "The availability confirmation request is invalid.",
        },
        {
          status: 400,
        },
      );
    }

    const bookingId =
      typeof body.bookingId === "string" ? body.bookingId.trim() : "";

    if (!bookingId) {
      return NextResponse.json(
        {
          error: "Booking ID is missing.",
        },
        {
          status: 400,
        },
      );
    }

    const { data: booking, error: bookingLoadError } = await supabaseAdmin
      .from("bookings")
      .select(
        `
          id,
          booking_reference,
          status,
          booking_type,
          start_date,
          end_date,
          availability_confirmation_required,
          availability_confirmed_at,
          availability_confirmed_by
          `,
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingLoadError) {
      return NextResponse.json(
        {
          error: bookingLoadError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!booking) {
      return NextResponse.json(
        {
          error: "The booking could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    if (booking.status !== "Pending") {
      return NextResponse.json(
        {
          error:
            "Availability can only be confirmed while the booking is Pending.",
        },
        {
          status: 409,
        },
      );
    }

    if (!booking.availability_confirmation_required) {
      return NextResponse.json(
        {
          error: "This booking does not require an availability review.",
        },
        {
          status: 409,
        },
      );
    }

    if (booking.availability_confirmed_at) {
      return NextResponse.json({
        success: true,
        availabilityConfirmed: true,
        alreadyConfirmed: true,
        booking: {
          id: booking.id,
          bookingReference: booking.booking_reference,
          bookingType: booking.booking_type,
          startDate: booking.start_date,
          endDate: booking.end_date,
          availabilityConfirmationRequired: true,
          availabilityConfirmedAt: booking.availability_confirmed_at,
          availabilityConfirmedBy: booking.availability_confirmed_by,
        },
        createdAvailabilityDates: 0,
        message: "Availability has already been confirmed for this booking.",
      });
    }

    const { data: approvalRows, error: approvalError } =
      await supabaseAdmin.rpc("confirm_booking_availability_v2_atomic", {
        p_booking_id: booking.id,
        p_admin_user_id: user.id,
      });

    if (approvalError) {
      const errorResponse = getApprovalErrorResponse(
        approvalError.message ||
          "The booking availability could not be confirmed.",
      );

      return NextResponse.json(
        {
          error: errorResponse.error,
        },
        {
          status: errorResponse.status,
        },
      );
    }

    const approvalResult = (
      Array.isArray(approvalRows) ? approvalRows[0] : approvalRows
    ) as AvailabilityApprovalResult | null;

    if (!approvalResult) {
      return NextResponse.json(
        {
          error:
            "Availability was confirmed without returning a booking result.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,
      availabilityConfirmed: true,
      alreadyConfirmed: false,
      booking: {
        id: approvalResult.booking_id,
        bookingReference: approvalResult.booking_reference,
        bookingType: booking.booking_type,
        startDate: booking.start_date,
        endDate: booking.end_date,
        availabilityConfirmationRequired:
          approvalResult.availability_confirmation_required,
        availabilityConfirmedAt: approvalResult.availability_confirmed_at,
        availabilityConfirmedBy: approvalResult.availability_confirmed_by,
      },
      createdAvailabilityDates: Number(
        approvalResult.created_availability_dates,
      ),
      message:
        Number(approvalResult.created_availability_dates) > 0
          ? `Availability was confirmed and ${approvalResult.created_availability_dates} missing availability record(s) were created.`
          : "Availability was confirmed for this booking.",
    });
  } catch (error) {
    console.error(
      "Administrator booking availability confirmation failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to confirm booking availability.",
      },
      {
        status: 500,
      },
    );
  }
}
