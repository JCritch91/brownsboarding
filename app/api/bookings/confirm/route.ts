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

import {
  buildBookingCalendarPayload,
} from "@/lib/services/booking-payloads";

type AvailabilityCalendarFailure = {
  date: string;
  error: string;
};

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

const {
  data: confirmationData,
  error: confirmationError,
} = await supabaseAdmin
  .rpc("confirm_booking_atomic", {
    p_booking_id: booking.id,
    p_pricing_setting_id: pricing.id,
    p_nightly_rate: nightlyRate,
    p_number_of_nights:
      pricingResult.numberOfNights,
    p_total_cost:
      pricingResult.totalCost,
    p_deposit_amount:
      pricingResult.depositAmount,
    p_balance_amount:
      pricingResult.balanceAmount,
    p_new_status:
      pricingResult.newStatus,
  })
  .single();

if (confirmationError) {
  console.error(
    "Atomic booking confirmation failed:",
    confirmationError
  );

  const errorMessage =
    confirmationError.message ||
    "The booking could not be confirmed.";

  if (
    errorMessage.includes(
      "BOOKING_NOT_PENDING"
    )
  ) {
    return NextResponse.json(
      {
        error:
          "The booking has already been processed and can no longer be confirmed.",
      },
      {
        status: 409,
      }
    );
  }

  if (
    errorMessage.includes(
      "INSUFFICIENT_AVAILABILITY"
    )
  ) {
    return NextResponse.json(
      {
        error:
          "The booking could not be confirmed because one or more dates are no longer available.",
      },
      {
        status: 409,
      }
    );
  }

  if (
    errorMessage.includes(
      "BOOKING_NOT_FOUND"
    )
  ) {
    return NextResponse.json(
      {
        error:
          "The booking could not be found.",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json(
    {
      error: errorMessage,
    },
    {
      status: 500,
    }
  );
}

if (!confirmationData) {
  return NextResponse.json(
    {
      error:
        "The confirmation completed without returning a booking result.",
    },
    {
      status: 500,
    }
  );
}

const {
  data: updatedAvailability,
  error: updatedAvailabilityError,
} = await supabaseAdmin
  .from("availability")
  .select(
    `
    id,
    date,
    available,
    total_spaces,
    spaces_available,
    notes
    `
  )
  .gte("date", booking.start_date)
  .lt("date", booking.end_date)
  .order("date", { ascending: true });

if (updatedAvailabilityError) {
  return NextResponse.json(
    {
      success: true,
      databaseConfirmed: true,
      followUpRequired: true,
      booking: {
        id: booking.id,
        bookingReference:
          booking.booking_reference,
        previousStatus:
          booking.status,
        newStatus:
          pricingResult.newStatus,
        startDate:
          booking.start_date,
        endDate:
          booking.end_date,
      },
      error:
        `The booking was confirmed, but the updated availability records could not be loaded: ${updatedAvailabilityError.message}`,
    },
    {
      status: 207,
    }
  );
}

const availabilityCalendarFailures:
  AvailabilityCalendarFailure[] = [];

let availabilityCalendarSyncedDates = 0;

const requestOrigin =
  new URL(request.url).origin;

for (
  const availabilityRecord of
    updatedAvailability || []
) {
  try {
    const calendarResponse = await fetch(
      `${requestOrigin}/api/google/sync-availability-event`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          availabilityId:
            availabilityRecord.id,
          date:
            availabilityRecord.date,
          available:
            availabilityRecord.available,
          totalSpaces:
            availabilityRecord.total_spaces,
          spacesAvailable:
            availabilityRecord.spaces_available,
          notes:
            availabilityRecord.notes,
        }),
      }
    );

    if (!calendarResponse.ok) {
      const calendarErrorText =
        await calendarResponse.text();

      availabilityCalendarFailures.push({
        date: availabilityRecord.date,
        error:
          calendarErrorText ||
          "Google Calendar returned an unsuccessful response.",
      });

      console.error(
        `Availability calendar sync failed for ${availabilityRecord.date}:`,
        calendarErrorText
      );

      continue;
    }

    availabilityCalendarSyncedDates += 1;
  } catch (calendarError) {
    const errorMessage =
      calendarError instanceof Error
        ? calendarError.message
        : "Unknown Google Calendar error.";

    availabilityCalendarFailures.push({
      date: availabilityRecord.date,
      error: errorMessage,
    });

    console.error(
      `Availability calendar sync failed for ${availabilityRecord.date}:`,
      calendarError
    );
  }
}

const availabilityCalendarSynced =
  availabilityCalendarFailures.length === 0;

  const customerName =
  `${customer.first_name || ""} ${
    customer.last_name || ""
  }`.trim() ||
  customer.email ||
  "Customer";

const shortNoticeBooking =
  pricingResult.depositAmount === 0;

const paymentStatus = shortNoticeBooking
  ? "Full balance due"
  : "Deposit due";

const bookingCalendarPayload =
  buildBookingCalendarPayload({
    bookingId: booking.id,
    bookingReference:
      booking.booking_reference,
    customerName,
    customerEmail:
      customer.email,
    dogName:
      dog.name,
    dogBreed:
      dog.breed,
    startDate:
      booking.start_date,
    endDate:
      booking.end_date,
    bookingStatus:
      pricingResult.newStatus,
    paymentStatus,
    notes:
      booking.notes,
    pricing:
      pricingResult,
  });

let bookingCalendarCreated = false;
let bookingCalendarError: string | null = null;

try {
  const bookingCalendarResponse = await fetch(
    `${requestOrigin}/api/google/create-booking-event`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        bookingCalendarPayload
      ),
    }
  );

  if (!bookingCalendarResponse.ok) {
    const responseText =
      await bookingCalendarResponse.text();

    bookingCalendarError =
      responseText ||
      "Google Calendar returned an unsuccessful response.";

    console.error(
      `Booking calendar creation failed for ${booking.booking_reference}:`,
      bookingCalendarError
    );
  } else {
    bookingCalendarCreated = true;
  }
} catch (calendarError) {
  bookingCalendarError =
    calendarError instanceof Error
      ? calendarError.message
      : "Unknown Google booking calendar error.";

  console.error(
    `Booking calendar creation failed for ${booking.booking_reference}:`,
    calendarError
  );
}


const calendarFollowUpRequired =
  !availabilityCalendarSynced ||
  !bookingCalendarCreated;

return NextResponse.json(
  {
    success: true,
    databaseConfirmed: true,
    followUpRequired: true,

    booking: {
      id: booking.id,
      bookingReference:
        booking.booking_reference,
      previousStatus:
        booking.status,
      newStatus:
        pricingResult.newStatus,
      startDate:
        booking.start_date,
      endDate:
        booking.end_date,
      notes:
        booking.notes,
    },

    customer: {
      id: customer.id,
      name: customerName,
      email:
        customer.email,
    },

    dog: {
      id: dog.id,
      name: dog.name,
      breed: dog.breed,
    },

    pricing: {
      pricingSettingId:
        pricing.id,
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
      records:
        updatedAvailability || [],
      occupiedDates,
      checkedDates:
        occupiedDates.length,
      calendarSynced:
        availabilityCalendarSynced,
      calendarSyncedDates:
        availabilityCalendarSyncedDates,
      calendarFailures:
        availabilityCalendarFailures,
    },

    bookingCalendar: {
      created:
        bookingCalendarCreated,
      error:
        bookingCalendarError,
    },

    email: {
      sent: false,
      required: true,
    },

    message:
      calendarFollowUpRequired
        ? "The booking was confirmed, but one or more Google Calendar operations could not be completed."
        : "The booking was confirmed and both Google calendars were updated. The confirmation email is still required.",
  },
  {
    status:
      calendarFollowUpRequired
        ? 207
        : 200,
  }
);

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