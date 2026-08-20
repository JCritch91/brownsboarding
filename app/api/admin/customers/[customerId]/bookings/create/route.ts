import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getDatesInRange, validateBookingDates } from "@/lib/helpers";

import { ACTIVE_BOOKING_STATUSES } from "@/types/booking";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

export async function POST(request: Request, context: RouteContext) {
  try {
    const { customerId } = await context.params;

    if (typeof customerId !== "string" || !customerId.trim()) {
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
      ? authorizationHeader.slice(7)
      : null;

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

    const dogId = typeof body.dogId === "string" ? body.dogId.trim() : "";

    const startDate =
      typeof body.startDate === "string" ? body.startDate.trim() : "";

    const endDate = typeof body.endDate === "string" ? body.endDate.trim() : "";

    if (
      body.notes !== undefined &&
      body.notes !== null &&
      typeof body.notes !== "string"
    ) {
      return NextResponse.json(
        {
          error: "The booking notes are invalid.",
        },
        {
          status: 400,
        },
      );
    }

    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

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

    const validationMessage = validateBookingDates(startDate, endDate);

    if (validationMessage) {
      return NextResponse.json(
        {
          error: validationMessage,
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
        name,
        active,
        vaccinated,
        vaccination_expiry,
        meet_and_greet_completed
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

    if (!dog.vaccinated) {
      return NextResponse.json(
        {
          error: "The selected dog's vaccination information is incomplete.",
        },
        {
          status: 409,
        },
      );
    }

    if (!dog.vaccination_expiry) {
      return NextResponse.json(
        {
          error: "The selected dog's vaccination expiry date is missing.",
        },
        {
          status: 409,
        },
      );
    }

    if (dog.vaccination_expiry < startDate) {
      return NextResponse.json(
        {
          error:
            "The selected dog's vaccination will have expired before the booking begins.",
        },
        {
          status: 409,
        },
      );
    }

    const { data: existingBookings, error: overlapLoadError } =
      await supabaseAdmin
        .from("bookings")
        .select(
          `
        id,
        start_date,
        end_date,
        status
        `,
        )
        .eq("dog_id", dog.id)
        .in("status", ACTIVE_BOOKING_STATUSES);

    if (overlapLoadError) {
      return NextResponse.json(
        {
          error: overlapLoadError.message,
        },
        {
          status: 500,
        },
      );
    }

    const overlappingBooking = (existingBookings || []).find(
      (existingBooking) =>
        startDate < existingBooking.end_date &&
        endDate > existingBooking.start_date,
    );

    if (overlappingBooking) {
      return NextResponse.json(
        {
          error:
            "The selected dog already has a booking that overlaps with these dates.",
        },
        {
          status: 409,
        },
      );
    }

    const occupiedDates = getDatesInRange(startDate, endDate);

    /*
     * The departure date does not consume a
     * boarding space.
     */
    occupiedDates.pop();

    if (occupiedDates.length === 0) {
      return NextResponse.json(
        {
          error: "The booking must contain at least one occupied night.",
        },
        {
          status: 400,
        },
      );
    }

    const { data: availabilityRecords, error: availabilityLoadError } =
      await supabaseAdmin
        .from("availability")
        .select(
          `
        id,
        date,
        available,
        total_spaces,
        spaces_available
        `,
        )
        .gte("date", startDate)
        .lt("date", endDate)
        .order("date", {
          ascending: true,
        });

    if (availabilityLoadError) {
      return NextResponse.json(
        {
          error: availabilityLoadError.message,
        },
        {
          status: 500,
        },
      );
    }

    const availabilityByDate = new Map(
      (availabilityRecords || []).map((record) => [record.date, record]),
    );

    for (const occupiedDate of occupiedDates) {
      const availabilityRecord = availabilityByDate.get(occupiedDate);

      if (!availabilityRecord) {
        return NextResponse.json(
          {
            error: `No availability has been configured for ${occupiedDate}.`,
          },
          {
            status: 409,
          },
        );
      }

      if (!availabilityRecord.available) {
        return NextResponse.json(
          {
            error: `${occupiedDate} is unavailable.`,
          },
          {
            status: 409,
          },
        );
      }

      if (availabilityRecord.spaces_available <= 0) {
        return NextResponse.json(
          {
            error: `${occupiedDate} is fully booked.`,
          },
          {
            status: 409,
          },
        );
      }
    }

    /*
     * This route creates only the initial Pending
     * booking. Pending bookings do not consume
     * availability and do not trigger calendar or
     * email operations.
     *
     * If the administrator selected Confirm
     * Immediately, the page calls the existing
     * secure confirmation route afterwards.
     */
    const { data: booking, error: bookingCreateError } = await supabaseAdmin
      .from("bookings")
      .insert({
        owner_id: customer.id,
        dog_id: dog.id,
        start_date: startDate,
        end_date: endDate,
        status: "Pending",
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .select(
        `
        id,
        booking_reference,
        owner_id,
        dog_id,
        start_date,
        end_date,
        status,
        notes,
        created_at
        `,
      )
      .single();

    if (bookingCreateError || !booking) {
      return NextResponse.json(
        {
          error:
            bookingCreateError?.message || "The booking could not be created.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json(
      {
        success: true,
        bookingCreated: true,
        booking: {
          id: booking.id,
          bookingReference: booking.booking_reference,
          ownerId: booking.owner_id,
          dogId: booking.dog_id,
          startDate: booking.start_date,
          endDate: booking.end_date,
          status: booking.status,
          notes: booking.notes,
          createdAt: booking.created_at,
        },
        message: "The booking was created as Pending.",
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Admin customer booking creation failed:", error);

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
