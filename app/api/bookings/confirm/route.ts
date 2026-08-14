import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getDatesInRange,
  validateBookingDates,
} from "@/lib/helpers";

import {
  calculateBookingPricing,
} from "@/lib/services/booking-confirmation-service";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const authorizationHeader =
      request.headers.get("authorization");

    const accessToken =
      authorizationHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "You must be signed in as an administrator.",
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
          error: "Unable to verify the signed-in user.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: adminProfile,
      error: adminProfileError,
    } = await supabaseAdmin
      .from("profiles")
      .select("id, is_admin, active")
      .eq("id", user.id)
      .maybeSingle();

    if (adminProfileError) {
      return NextResponse.json(
        {
          error: adminProfileError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      !adminProfile ||
      !adminProfile.is_admin ||
      !adminProfile.active
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to confirm bookings.",
        },
        {
          status: 403,
        }
      );
    }

    const body = await request.json();
    const bookingId = body.bookingId;

    if (
      typeof bookingId !== "string" ||
      !bookingId.trim()
    ) {
      return NextResponse.json(
        {
          error: "Booking ID is missing.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: booking,
      error: bookingLoadError,
    } = await supabaseAdmin
      .from("bookings")
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
    pricing_setting_id,
    nightly_rate,
    number_of_nights,
    total_cost,
    deposit_amount,
    balance_amount
    `
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
        }
      );
    }

    if (!booking) {
      return NextResponse.json(
        {
          error: "Booking could not be found.",
        },
        {
          status: 404,
        }
      );
    }

    if (booking.status !== "Pending") {
      return NextResponse.json(
        {
          error:
            `A booking with status "${booking.status}" cannot be confirmed.`,
        },
        {
          status: 409,
        }
      );
    }

    const {
      data: customer,
      error: customerLoadError,
    } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        first_name,
        last_name,
        email,
        active
        `
      )
      .eq("id", booking.owner_id)
      .maybeSingle();

    if (customerLoadError) {
      return NextResponse.json(
        {
          error: customerLoadError.message,
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
            "The customer associated with this booking could not be found.",
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
            "The booking cannot be confirmed because the customer account is inactive.",
        },
        {
          status: 400,
        }
      );
    }

const bookingDateValidation =
  validateBookingDates(
    booking.start_date,
    booking.end_date
  );

if (bookingDateValidation) {
  return NextResponse.json(
    {
      error: bookingDateValidation,
    },
    {
      status: 400,
    }
  );
}

const { data: dog, error: dogLoadError } =
  await supabaseAdmin
    .from("dogs")
    .select(
      `
      id,
      owner_id,
      name,
      breed,
      active,
      vaccinated,
      vaccination_expiry,
      meet_and_greet_completed
      `
    )
    .eq("id", booking.dog_id)
    .eq("owner_id", booking.owner_id)
    .maybeSingle();

if (dogLoadError) {
  return NextResponse.json(
    {
      error: dogLoadError.message,
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
        "The dog associated with this booking could not be found.",
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
        "The booking cannot be confirmed because the dog is inactive.",
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
        "The booking cannot be confirmed because the dog's vaccination information is incomplete.",
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
        "The booking cannot be confirmed because the dog's vaccination expiry date is missing.",
    },
    {
      status: 400,
    }
  );
}

if (
  dog.vaccination_expiry <
  booking.start_date
) {
  return NextResponse.json(
    {
      error:
        "The booking cannot be confirmed because the dog's vaccination will have expired before the stay begins.",
    },
    {
      status: 400,
    }
  );
}

const {
  data: pricing,
  error: pricingLoadError,
} = await supabaseAdmin
  .from("pricing_settings")
  .select(
    `
    id,
    nightly_rate,
    deposit_percentage,
    active
    `
  )
  .eq("active", true)
  .limit(1)
  .maybeSingle();

if (pricingLoadError) {
  return NextResponse.json(
    {
      error: pricingLoadError.message,
    },
    {
      status: 500,
    }
  );
}

if (!pricing) {
  return NextResponse.json(
    {
      error:
        "No active pricing settings could be found.",
    },
    {
      status: 400,
    }
  );
}

const nightlyRate = Number(
  pricing.nightly_rate
);

const depositPercentage = Number(
  pricing.deposit_percentage
);

if (
  !Number.isFinite(nightlyRate) ||
  nightlyRate < 0
) {
  return NextResponse.json(
    {
      error:
        "The active nightly rate is invalid.",
    },
    {
      status: 500,
    }
  );
}

if (
  !Number.isFinite(depositPercentage) ||
  depositPercentage < 0 ||
  depositPercentage > 100
) {
  return NextResponse.json(
    {
      error:
        "The active deposit percentage is invalid.",
    },
    {
      status: 500,
    }
  );
}

const occupiedDates = getDatesInRange(
  booking.start_date,
  booking.end_date
);

/*
 * The departure date does not consume a boarding
 * space, so it is excluded from the availability
 * checks.
 */
occupiedDates.pop();

if (occupiedDates.length === 0) {
  return NextResponse.json(
    {
      error:
        "The booking does not contain any occupied nights.",
    },
    {
      status: 400,
    }
  );
}

const {
  data: availabilityRecords,
  error: availabilityLoadError,
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
  .gte("date", booking.start_date)
  .lt("date", booking.end_date)
  .order("date", { ascending: true });

if (availabilityLoadError) {
  return NextResponse.json(
    {
      error: availabilityLoadError.message,
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

for (const occupiedDate of occupiedDates) {
  const availabilityRecord =
    availabilityByDate.get(occupiedDate);

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
          `${occupiedDate} is unavailable for bookings.`,
      },
      {
        status: 409,
      }
    );
  }

  if (
    availabilityRecord.spaces_available <= 0
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

const pricingResult =
  calculateBookingPricing(
    booking.start_date,
    booking.end_date,
    nightlyRate,
    depositPercentage
  );

return NextResponse.json({
  success: true,
  readyForConfirmation: true,
  booking: {
    id: booking.id,
    bookingReference:
      booking.booking_reference,
    currentStatus: booking.status,
    confirmationStatus:
      pricingResult.newStatus,
    startDate: booking.start_date,
    endDate: booking.end_date,
  },
  customer: {
    id: customer.id,
    name:
      `${customer.first_name || ""} ${
        customer.last_name || ""
      }`.trim() ||
      customer.email ||
      "Customer",
    email: customer.email,
  },
  dog: {
    id: dog.id,
    name: dog.name,
    breed: dog.breed,
  },
  pricing: {
    pricingSettingId: pricing.id,
    nightlyRate,
    depositPercentage,
    numberOfNights:
      pricingResult.numberOfNights,
    totalCost:
      pricingResult.totalCost,
    depositAmount:
      pricingResult.depositAmount,
    balanceAmount:
      pricingResult.balanceAmount,
  },
  availability: {
    occupiedDates,
    checkedDates: occupiedDates.length,
  },
  message:
    "Booking passed all confirmation validation checks.",
});
  } catch (error) {
    console.error(
      "Admin booking confirmation failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to confirm the booking.",
      },
      {
        status: 500,
      }
    );
  }
}