import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  getDatesInRange,
  validateBookingDates,
} from "@/lib/helpers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type CreateBookingRequestBody = {
  dogId?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  notes?: unknown;
};

const overlappingBookingStatuses = [
  "Pending",
  "Deposit Pending",
  "Balance Pending",
  "Balance Paid",
];

export async function POST(request: Request) {
  try {
    const authorizationHeader =
      request.headers.get("authorization");

    const accessToken =
      authorizationHeader?.replace(
        "Bearer ",
        ""
      );

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "You must be signed in to create a booking.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(
      accessToken
    );

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "Unable to verify the signed-in user.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: customer,
      error: customerError,
    } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        active,
        is_admin
        `
      )
      .eq("id", user.id)
      .maybeSingle();

    if (customerError) {
      return NextResponse.json(
        {
          error: customerError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!customer) {
      return NextResponse.json(
        {
          error:
            "Your customer account could not be found.",
        },
        {
          status: 404,
        }
      );
    }

    if (!customer.active) {
      return NextResponse.json(
        {
          error:
            "Your account is inactive. A booking cannot be created.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      (await request.json()) as CreateBookingRequestBody;

    const dogId = body.dogId;
    const startDate = body.startDate;
    const endDate = body.endDate;
    const suppliedNotes = body.notes;

    if (
      typeof dogId !== "string" ||
      !dogId.trim()
    ) {
      return NextResponse.json(
        {
          error: "Please select a dog.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      typeof startDate !== "string" ||
      typeof endDate !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "The booking dates are missing or invalid.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      suppliedNotes !== undefined &&
      suppliedNotes !== null &&
      typeof suppliedNotes !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "The booking notes are invalid.",
        },
        {
          status: 400,
        }
      );
    }

    const notes =
      typeof suppliedNotes === "string"
        ? suppliedNotes.trim()
        : "";

    if (notes.length > 2000) {
      return NextResponse.json(
        {
          error:
            "Booking notes must not exceed 2,000 characters.",
        },
        {
          status: 400,
        }
      );
    }

    const dateValidationMessage =
      validateBookingDates(
        startDate,
        endDate
      );

    if (dateValidationMessage) {
      return NextResponse.json(
        {
          error: dateValidationMessage,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Load the dog using both its ID and the signed-in
     * customer's ID. The browser cannot create a
     * booking for another customer's dog.
     */
    const {
      data: dog,
      error: dogError,
    } = await supabaseAdmin
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
        `
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
        }
      );
    }

    if (!dog) {
      return NextResponse.json(
        {
          error:
            "The selected dog could not be found.",
        },
        {
          status: 404,
        }
      );
    }

    if (!dog.active) {
      return NextResponse.json(
        {
          error:
            "A booking cannot be created for an inactive dog.",
        },
        {
          status: 400,
        }
      );
    }

    if (!dog.meet_and_greet_completed) {
      return NextResponse.json(
        {
          error:
            "The selected dog must complete a meet and greet before a booking can be requested.",
        },
        {
          status: 400,
        }
      );
    }

    if (!dog.vaccinated) {
      return NextResponse.json(
        {
          error:
            "The selected dog's vaccination information is incomplete.",
        },
        {
          status: 400,
        }
      );
    }

    if (!dog.vaccination_expiry) {
      return NextResponse.json(
        {
          error:
            "The selected dog's vaccination expiry date is missing.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      dog.vaccination_expiry < startDate
    ) {
      return NextResponse.json(
        {
          error:
            "The selected dog's vaccination will have expired before the booking begins.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Prevent the same dog from having two active
     * booking records for overlapping dates.
     *
     * Two date ranges overlap when:
     * new start < existing end
     * and
     * new end > existing start
     */
    const {
      data: existingBookings,
      error: overlapLoadError,
    } = await supabaseAdmin
      .from("bookings")
      .select(
        `
        id,
        start_date,
        end_date,
        status
        `
      )
      .eq("dog_id", dog.id)
      .in(
        "status",
        overlappingBookingStatuses
      );

    if (overlapLoadError) {
      return NextResponse.json(
        {
          error: overlapLoadError.message,
        },
        {
          status: 500,
        }
      );
    }

    const overlappingBooking =
      (existingBookings || []).find(
        (existingBooking) =>
          startDate <
            existingBooking.end_date &&
          endDate >
            existingBooking.start_date
      );

    if (overlappingBooking) {
      return NextResponse.json(
        {
          error:
            "The selected dog already has a booking that overlaps with these dates.",
        },
        {
          status: 409,
        }
      );
    }

    const occupiedDates = getDatesInRange(
      startDate,
      endDate
    );

    /*
     * The dog does not consume a boarding space on
     * the departure date.
     */
    occupiedDates.pop();

    if (occupiedDates.length === 0) {
      return NextResponse.json(
        {
          error:
            "The booking must contain at least one occupied night.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: availabilityRecords,
      error: availabilityError,
    } = await supabaseAdmin
      .from("availability")
      .select(
        `
        id,
        date,
        available,
        total_spaces,
        spaces_available
        `
      )
      .gte("date", startDate)
      .lt("date", endDate)
      .order("date", {
        ascending: true,
      });

    if (availabilityError) {
      return NextResponse.json(
        {
          error: availabilityError.message,
        },
        {
          status: 500,
        }
      );
    }

    const availabilityByDate = new Map(
      (availabilityRecords || []).map(
        (availabilityRecord) => [
          availabilityRecord.date,
          availabilityRecord,
        ]
      )
    );

    for (
      const occupiedDate of occupiedDates
    ) {
      const availabilityRecord =
        availabilityByDate.get(
          occupiedDate
        );

      if (!availabilityRecord) {
        return NextResponse.json(
          {
            error:
              `No availability has been configured for ${occupiedDate}.`,
          },
          {
            status: 409,
          }
        );
      }

      if (!availabilityRecord.available) {
        return NextResponse.json(
          {
            error:
              `${occupiedDate} is unavailable.`,
          },
          {
            status: 409,
          }
        );
      }

      if (
        availabilityRecord.spaces_available <=
        0
      ) {
        return NextResponse.json(
          {
            error:
              `${occupiedDate} is fully booked.`,
          },
          {
            status: 409,
          }
        );
      }
    }

    /*
     * Customer booking requests are always created as
     * Pending. Pending requests do not reduce capacity,
     * create calendar events or send confirmation
     * emails.
     */
    const {
      data: booking,
      error: bookingCreateError,
    } = await supabaseAdmin
      .from("bookings")
      .insert({
        owner_id: user.id,
        dog_id: dog.id,
        start_date: startDate,
        end_date: endDate,
        status: "Pending",
        notes: notes || null,
        updated_at:
          new Date().toISOString(),
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
        `
      )
      .single();

    if (bookingCreateError || !booking) {
      return NextResponse.json(
        {
          error:
            bookingCreateError?.message ||
            "The booking request could not be created.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        bookingCreated: true,

        booking: {
          id: booking.id,
          bookingReference:
            booking.booking_reference,
          ownerId: booking.owner_id,
          dogId: booking.dog_id,
          startDate:
            booking.start_date,
          endDate:
            booking.end_date,
          status: booking.status,
        },

        message:
          "Your booking request has been submitted successfully. Browns Boarding will review it shortly.",
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Customer booking creation failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create the booking request.",
      },
      {
        status: 500,
      }
    );
  }
}