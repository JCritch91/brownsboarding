import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getBookingOccupiedDates } from "@/lib/booking-engine/domain";

import {
  calculateBookingEnginePricing,
  type BookingEnginePricingSettings,
} from "@/lib/booking-engine/pricing";

import {
  buildBookingCalendarPayload,
  buildBookingConfirmationEmailPayload,
} from "@/lib/services/booking-payloads";

import { createBookingCalendarEvent } from "@/lib/services/booking-calendar-service";

import { sendBookingConfirmationEmail } from "@/lib/services/booking-confirmation-email-service";

import { syncAvailabilityCalendarEvent } from "@/lib/services/availability-calendar-sync-service";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type AvailabilityCalendarFailure = {
  date: string;
  error: string;
};

export async function POST(request: Request) {
  try {
    const authorizationHeader = request.headers.get("authorization");

    const accessToken = authorizationHeader?.replace("Bearer ", "");

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
        },
      );
    }

    if (!adminProfile || !adminProfile.is_admin || !adminProfile.active) {
      return NextResponse.json(
        {
          error: "You do not have permission to confirm bookings.",
        },
        {
          status: 403,
        },
      );
    }

    const body = (await request.json()) as {
      bookingId?: unknown;
    };

    const bookingId = body.bookingId;

    if (typeof bookingId !== "string" || !bookingId.trim()) {
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
owner_id,
dog_id,
booking_type,
daycare_session,
start_date,
end_date,
status,
availability_confirmation_required,
availability_confirmed_at,
availability_confirmed_by,
space_units,
    notes,
pricing_setting_id,
price_unit,
unit_rate,
quantity,
deposit_percentage_applied,
nightly_rate,
number_of_nights,
total_cost,
    deposit_amount,
    balance_amount
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
          error: "Booking could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    if (booking.status !== "Pending") {
      return NextResponse.json(
        {
          error: `A booking with status "${booking.status}" cannot be confirmed.`,
        },
        {
          status: 409,
        },
      );
    }

    if (
      booking.availability_confirmation_required &&
      !booking.availability_confirmed_at
    ) {
      return NextResponse.json(
        {
          error:
            "Availability must be reviewed and confirmed before this booking can be confirmed.",
        },
        {
          status: 409,
        },
      );
    }

    const { data: customer, error: customerLoadError } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        first_name,
        last_name,
        email,
        active
        `,
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
        },
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
        },
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
      breed,
      active,
      vaccinated,
      vaccination_expiry,
      meet_and_greet_completed
      `,
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
        },
      );
    }

    if (!dog) {
      return NextResponse.json(
        {
          error: "The dog associated with this booking could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    if (!dog.active) {
      return NextResponse.json(
        {
          error: "The booking cannot be confirmed because the dog is inactive.",
        },
        {
          status: 400,
        },
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
        },
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
        },
      );
    }

    if (dog.vaccination_expiry < booking.start_date) {
      return NextResponse.json(
        {
          error:
            "The booking cannot be confirmed because the dog's vaccination will have expired before the stay begins.",
        },
        {
          status: 400,
        },
      );
    }

    const { data: pricing, error: pricingLoadError } = await supabaseAdmin
      .from("pricing_settings")
      .select(
        `
  id,
  nightly_rate,
  deposit_percentage,
  daycare_full_day_rate,
  daycare_half_day_rate,
  daycare_deposit_percentage,
  effective_from,
  active
  `,
      )
      .eq("active", true)
      .lte("effective_from", booking.start_date)
      .order("effective_from", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (pricingLoadError) {
      return NextResponse.json(
        {
          error: pricingLoadError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!pricing) {
      return NextResponse.json(
        {
          error:
            "No pricing settings are available for the booking start date.",
        },
        {
          status: 400,
        },
      );
    }

    let pricingResult;

    try {
      pricingResult = calculateBookingEnginePricing({
        bookingType: booking.booking_type,
        daycareSession: booking.daycare_session,
        startDate: booking.start_date,
        endDate: booking.end_date,
        pricing: {
          id: pricing.id,
          nightly_rate: Number(pricing.nightly_rate),
          deposit_percentage: Number(pricing.deposit_percentage),
          daycare_full_day_rate: Number(pricing.daycare_full_day_rate),
          daycare_half_day_rate: Number(pricing.daycare_half_day_rate),
          daycare_deposit_percentage: Number(
            pricing.daycare_deposit_percentage,
          ),
          effective_from: pricing.effective_from,
          active: pricing.active,
        } satisfies BookingEnginePricingSettings,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "The booking price could not be calculated.",
        },
        {
          status: 500,
        },
      );
    }

    const occupiedDates = getBookingOccupiedDates({
      bookingType: booking.booking_type,
      startDate: booking.start_date,
      endDate: booking.end_date,
    });

    if (occupiedDates.length === 0) {
      return NextResponse.json(
        {
          error:
            booking.booking_type === "daycare"
              ? "The daycare booking does not contain a valid attendance date."
              : "The boarding booking does not contain any occupied nights.",
        },
        {
          status: 400,
        },
      );
    }

    const { data: confirmationRows, error: confirmationError } =
      await supabaseAdmin.rpc("confirm_booking_v2_atomic", {
        p_booking_id: booking.id,
        p_pricing_setting_id: pricingResult.pricingSettingId,
        p_price_unit: pricingResult.priceUnit,
        p_unit_rate: pricingResult.unitRate,
        p_quantity: pricingResult.quantity,
        p_deposit_percentage: pricingResult.depositPercentage,
        p_total_cost: pricingResult.totalCost,
        p_deposit_amount: pricingResult.depositAmount,
        p_balance_amount: pricingResult.balanceAmount,
        p_new_status: pricingResult.newStatus,
      });

    const confirmationData = Array.isArray(confirmationRows)
      ? confirmationRows[0]
      : confirmationRows;

    if (confirmationError) {
      console.error(
        "Atomic V2 booking confirmation failed:",
        confirmationError,
      );

      const errorMessage =
        confirmationError.message || "The booking could not be confirmed.";

      if (
        errorMessage.includes("BOOKING_NOT_PENDING") ||
        errorMessage.includes("BOOKING_STATUS_CHANGED")
      ) {
        return NextResponse.json(
          {
            error:
              "The booking has already been processed and can no longer be confirmed.",
          },
          {
            status: 409,
          },
        );
      }

      if (errorMessage.includes("AVAILABILITY_REVIEW_REQUIRED")) {
        return NextResponse.json(
          {
            error:
              "Availability must be reviewed and confirmed before this booking can be confirmed.",
          },
          {
            status: 409,
          },
        );
      }

      if (errorMessage.includes("AVAILABILITY_RECORD_MISSING")) {
        return NextResponse.json(
          {
            error: "One or more required availability records are missing.",
          },
          {
            status: 409,
          },
        );
      }

      if (errorMessage.includes("AVAILABILITY_UNAVAILABLE")) {
        return NextResponse.json(
          {
            error: "One or more booking dates have been marked as unavailable.",
          },
          {
            status: 409,
          },
        );
      }

      if (errorMessage.includes("INSUFFICIENT_AVAILABILITY")) {
        return NextResponse.json(
          {
            error:
              "One or more booking dates no longer have sufficient availability.",
          },
          {
            status: 409,
          },
        );
      }

      if (errorMessage.includes("REQUESTED_DOG_CANNOT_SHARE")) {
        return NextResponse.json(
          {
            error:
              "One or more selected dogs cannot share with dogs from another household.",
          },
          {
            status: 409,
          },
        );
      }

      if (errorMessage.includes("EXISTING_DOG_CANNOT_SHARE")) {
        return NextResponse.json(
          {
            error:
              "A dog already attending on one or more selected dates cannot share with dogs from another household.",
          },
          {
            status: 409,
          },
        );
      }

      if (errorMessage.includes("SHARED_BOOKING_LIMIT_REACHED")) {
        return NextResponse.json(
          {
            error:
              "The additional compatible shared-booking allowance has already been used for one or more selected dates.",
          },
          {
            status: 409,
          },
        );
      }

      if (errorMessage.includes("BOOKING_NOT_FOUND")) {
        return NextResponse.json(
          {
            error: "The booking could not be found.",
          },
          {
            status: 404,
          },
        );
      }

      if (
        errorMessage.includes("INVALID_BOARDING_DATES") ||
        errorMessage.includes("INVALID_DAYCARE_DATES") ||
        errorMessage.includes("INVALID_BOOKING_TYPE") ||
        errorMessage.includes("INVALID_BOARDING_QUANTITY") ||
        errorMessage.includes("INVALID_DAYCARE_QUANTITY") ||
        errorMessage.includes("INVALID_BOARDING_PRICE_UNIT") ||
        errorMessage.includes("INVALID_DAYCARE_PRICE_UNIT")
      ) {
        return NextResponse.json(
          {
            error:
              "The booking contains invalid service, date or pricing information.",
          },
          {
            status: 400,
          },
        );
      }

      if (errorMessage.includes("PRICING_TOTAL_MISMATCH")) {
        return NextResponse.json(
          {
            error:
              "The calculated booking price does not match its deposit and balance.",
          },
          {
            status: 500,
          },
        );
      }

      return NextResponse.json(
        {
          error: errorMessage,
        },
        {
          status: 500,
        },
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
        },
      );
    }

    const { data: updatedAvailability, error: updatedAvailabilityError } =
      await supabaseAdmin
        .from("availability")
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
        .in("date", occupiedDates)
        .order("date", {
          ascending: true,
        });

    if (updatedAvailabilityError) {
      return NextResponse.json(
        {
          success: true,
          databaseConfirmed: true,
          followUpRequired: true,
          booking: {
            id: booking.id,
            bookingReference: booking.booking_reference,
            previousStatus: booking.status,
            newStatus: pricingResult.newStatus,
            startDate: booking.start_date,
            endDate: booking.end_date,
          },
          error: `The booking was confirmed, but the updated availability records could not be loaded: ${updatedAvailabilityError.message}`,
        },
        {
          status: 207,
        },
      );
    }

    const availabilityCalendarFailures: AvailabilityCalendarFailure[] = [];

    let availabilityCalendarSyncedDates = 0;

    const availabilityCalendarResults = await Promise.allSettled(
      (updatedAvailability || []).map(async (availabilityRecord) => {
        await syncAvailabilityCalendarEvent({
          availabilityId: availabilityRecord.id,
          date: availabilityRecord.date,
          available: availabilityRecord.available,
          totalSpaces: availabilityRecord.total_spaces,
          spacesAvailable: availabilityRecord.spaces_available,
          notes: availabilityRecord.notes,
        });

        return availabilityRecord.date;
      }),
    );

    availabilityCalendarResults.forEach((calendarResult, index) => {
      const availabilityRecord = (updatedAvailability || [])[index];

      if (calendarResult.status === "fulfilled") {
        availabilityCalendarSyncedDates += 1;
        return;
      }

      const errorMessage =
        calendarResult.reason instanceof Error
          ? calendarResult.reason.message
          : "Unknown Google Calendar error.";

      availabilityCalendarFailures.push({
        date: availabilityRecord?.date || "unknown date",
        error: errorMessage,
      });

      console.error(
        `Availability calendar sync failed for ${
          availabilityRecord?.date || "unknown date"
        }:`,
        calendarResult.reason,
      );
    });

    const availabilityCalendarSynced =
      availabilityCalendarFailures.length === 0;

    const customerName =
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
      customer.email ||
      "Customer";

    const shortNoticeBooking = pricingResult.shortNoticeBooking;

    const paymentStatus = shortNoticeBooking
      ? "Full balance due"
      : "Deposit due";

    const bookingCalendarPayload = buildBookingCalendarPayload({
      bookingId: booking.id,
      bookingReference: booking.booking_reference,
      customerName,
      customerEmail: customer.email,
      dogName: dog.name,
      dogBreed: dog.breed,
      startDate: booking.start_date,
      endDate: booking.end_date,
      bookingStatus: pricingResult.newStatus,
      paymentStatus,
      notes: booking.notes,
      pricing: pricingResult,
    });

    let bookingCalendarCreated = false;
    let bookingCalendarError: string | null = null;

    try {
      await createBookingCalendarEvent(bookingCalendarPayload);

      bookingCalendarCreated = true;
    } catch (calendarError) {
      bookingCalendarError =
        calendarError instanceof Error
          ? calendarError.message
          : "Unknown Google booking calendar error.";

      console.error(
        `Booking calendar creation failed for ${booking.booking_reference}:`,
        calendarError,
      );
    }

    const confirmationEmailPayload = buildBookingConfirmationEmailPayload({
      bookingReference: booking.booking_reference,
      customerEmail: customer.email,
      customerName,
      dogName: dog.name,
      startDate: booking.start_date,
      endDate: booking.end_date,
      shortNoticeBooking,
      pricing: pricingResult,
    });

    let confirmationEmailSent = false;
    let confirmationEmailError: string | null = null;

    if (!customer.email) {
      confirmationEmailError = "The customer does not have an email address.";
    } else {
      try {
        await sendBookingConfirmationEmail({
          ...confirmationEmailPayload,
          customerEmail: customer.email,
        });

        confirmationEmailSent = true;
      } catch (emailError) {
        confirmationEmailError =
          emailError instanceof Error
            ? emailError.message
            : "Unknown booking confirmation email error.";

        console.error(
          `Booking confirmation email failed for ${booking.booking_reference}:`,
          emailError,
        );
      }
    }

    const followUpRequired =
      !availabilityCalendarSynced ||
      !bookingCalendarCreated ||
      !confirmationEmailSent;

    const failedOperations: string[] = [];

    if (!availabilityCalendarSynced) {
      failedOperations.push(
        `${availabilityCalendarFailures.length} availability calendar event(s)`,
      );
    }

    if (!bookingCalendarCreated) {
      failedOperations.push("the Google booking calendar event");
    }

    if (!confirmationEmailSent) {
      failedOperations.push("the customer confirmation email");
    }

    return NextResponse.json(
      {
        success: true,
        databaseConfirmed: true,
        followUpRequired,

        booking: {
          id: booking.id,
          bookingReference: booking.booking_reference,
          previousStatus: booking.status,
          newStatus: pricingResult.newStatus,
          startDate: booking.start_date,
          endDate: booking.end_date,
          notes: booking.notes,
        },

        customer: {
          id: customer.id,
          name: customerName,
          email: customer.email,
        },

        dog: {
          id: dog.id,
          name: dog.name,
          breed: dog.breed,
        },

        pricing: {
          pricingSettingId: pricingResult.pricingSettingId,
          priceUnit: pricingResult.priceUnit,
          unitRate: pricingResult.unitRate,
          quantity: pricingResult.quantity,
          depositPercentage: pricingResult.depositPercentage,
          numberOfNights: pricingResult.numberOfNights,
          nightlyRate: pricingResult.nightlyRate,
          totalCost: pricingResult.totalCost,
          depositAmount: pricingResult.depositAmount,
          balanceAmount: pricingResult.balanceAmount,
        },

        availability: {
          records: updatedAvailability || [],
          occupiedDates,
          checkedDates: occupiedDates.length,
          calendarSynced: availabilityCalendarSynced,
          calendarSyncedDates: availabilityCalendarSyncedDates,
          calendarFailures: availabilityCalendarFailures,
        },

        bookingCalendar: {
          created: bookingCalendarCreated,
          error: bookingCalendarError,
        },

        email: {
          sent: confirmationEmailSent,
          error: confirmationEmailError,
        },

        message: followUpRequired
          ? `The booking was confirmed, but the following operation(s) could not be completed: ${failedOperations.join(
              ", ",
            )}.`
          : "The booking was confirmed successfully, both Google calendars were updated and the confirmation email was sent.",
      },
      {
        status: followUpRequired ? 207 : 200,
      },
    );
  } catch (error) {
    console.error("Admin booking confirmation failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to confirm the booking.",
      },
      {
        status: 500,
      },
    );
  }
}
