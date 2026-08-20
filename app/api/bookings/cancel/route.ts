import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { formatDisplayDate, formatMoney, formatName } from "@/lib/helpers";

import { syncAvailabilityCalendarEvent } from "@/lib/services/availability-calendar-sync-service";
import { updateBookingCalendarEvent } from "@/lib/services/booking-calendar-service";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type CancellationRequestBody = {
  bookingId?: unknown;
};

type AvailabilityCalendarFailure = {
  date: string;
  error: string;
};

const statusesThatConsumedAvailability = [
  "Deposit Pending",
  "Balance Pending",
  "Balance Paid",
];

export async function POST(request: Request) {
  try {
    const authorizationHeader = request.headers.get("authorization");

    const accessToken = authorizationHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "You must be signed in to cancel a booking.",
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

    const body = (await request.json()) as CancellationRequestBody;

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

    const { data: signedInProfile, error: profileLoadError } =
      await supabaseAdmin
        .from("profiles")
        .select(
          `
        id,
        is_admin,
        active
        `,
        )
        .eq("id", user.id)
        .maybeSingle();

    if (profileLoadError) {
      return NextResponse.json(
        {
          error: profileLoadError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!signedInProfile || !signedInProfile.active) {
      return NextResponse.json(
        {
          error: "Your account is not authorised to cancel bookings.",
        },
        {
          status: 403,
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
        start_date,
        end_date,
        status,
        notes,
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

    const isBookingOwner = booking.owner_id === user.id;

    const isActiveAdmin = signedInProfile.is_admin === true;

    if (!isBookingOwner && !isActiveAdmin) {
      return NextResponse.json(
        {
          error: "You do not have permission to cancel this booking.",
        },
        {
          status: 403,
        },
      );
    }

    if (booking.status === "Cancelled") {
      return NextResponse.json(
        {
          error: "This booking has already been cancelled.",
        },
        {
          status: 409,
        },
      );
    }

    if (booking.status === "Completed") {
      return NextResponse.json(
        {
          error: "A completed booking cannot be cancelled.",
        },
        {
          status: 409,
        },
      );
    }

    const allowedStatuses = [
      "Pending",
      "Deposit Pending",
      "Balance Pending",
      "Balance Paid",
    ];

    if (!allowedStatuses.includes(booking.status)) {
      return NextResponse.json(
        {
          error: `A booking with status "${booking.status}" cannot be cancelled.`,
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
        email
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

    const { data: dog, error: dogLoadError } = await supabaseAdmin
      .from("dogs")
      .select(
        `
        id,
        owner_id,
        name,
        breed
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

    const previousStatus = booking.status;

    const shouldRestoreAvailability =
      statusesThatConsumedAvailability.includes(previousStatus);

    const { data: cancellationRows, error: cancellationError } =
      await supabaseAdmin.rpc("cancel_booking_atomic", {
        p_booking_id: booking.id,
      });

    if (cancellationError) {
      console.error("Atomic booking cancellation failed:", cancellationError);

      const errorMessage =
        cancellationError.message || "The booking could not be cancelled.";

      if (errorMessage.includes("BOOKING_ALREADY_CANCELLED")) {
        return NextResponse.json(
          {
            error: "This booking has already been cancelled.",
          },
          {
            status: 409,
          },
        );
      }

      if (errorMessage.includes("COMPLETED_BOOKING_CANNOT_BE_CANCELLED")) {
        return NextResponse.json(
          {
            error: "A completed booking cannot be cancelled.",
          },
          {
            status: 409,
          },
        );
      }

      if (errorMessage.includes("BOOKING_STATUS_CANNOT_BE_CANCELLED")) {
        return NextResponse.json(
          {
            error: "The current booking status cannot be cancelled.",
          },
          {
            status: 409,
          },
        );
      }

      if (
        errorMessage.includes("MISSING_AVAILABILITY_RECORDS") ||
        errorMessage.includes("AVAILABILITY_RESTORE_FAILED")
      ) {
        return NextResponse.json(
          {
            error:
              "The booking could not be cancelled because availability could not be restored safely.",
          },
          {
            status: 409,
          },
        );
      }

      if (errorMessage.includes("BOOKING_NOT_FOUND")) {
        return NextResponse.json(
          {
            error: "Booking could not be found.",
          },
          {
            status: 404,
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

    const cancellationResult = Array.isArray(cancellationRows)
      ? cancellationRows[0]
      : cancellationRows;

    if (!cancellationResult) {
      return NextResponse.json(
        {
          error: "The cancellation completed without returning a result.",
        },
        {
          status: 500,
        },
      );
    }

    const requestOrigin = new URL(request.url).origin;

    const customerName =
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
      customer.email ||
      "Customer";

    const dogName = formatName(dog.name || "") || "Dog";

    const dogBreed = dog.breed ? formatName(dog.breed) : null;

    /*
     * Run external follow-up operations concurrently.
     *
     * The database cancellation has already completed
     * atomically, so failures here are reported as
     * partial success without reverting the booking.
     */

    const availabilityCalendarFailures: AvailabilityCalendarFailure[] = [];

    let availabilityCalendarSyncedDates = 0;
    let updatedAvailability: unknown[] = [];

    const availabilityCalendarPromise = async () => {
      if (!shouldRestoreAvailability) {
        return;
      }

      const { data: availabilityData, error: availabilityLoadError } =
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
          .gte("date", booking.start_date)
          .lt("date", booking.end_date)
          .order("date", { ascending: true });

      if (availabilityLoadError) {
        availabilityCalendarFailures.push({
          date: "booking date range",
          error: `Availability was restored, but the updated records could not be loaded: ${availabilityLoadError.message}`,
        });

        return;
      }

      updatedAvailability = availabilityData || [];

      const syncResults = await Promise.allSettled(
        (availabilityData || []).map(async (availabilityRecord) => {
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

      syncResults.forEach((syncResult, index) => {
        const availabilityRecord = (availabilityData || [])[index];

        if (syncResult.status === "fulfilled") {
          availabilityCalendarSyncedDates += 1;
          return;
        }

        availabilityCalendarFailures.push({
          date: availabilityRecord?.date || "unknown date",
          error:
            syncResult.reason instanceof Error
              ? syncResult.reason.message
              : "Unknown availability calendar error.",
        });

        console.error(
          `Availability calendar sync failed for ${
            availabilityRecord?.date || "unknown date"
          }:`,
          syncResult.reason,
        );
      });
    };

    /*
     * Pending bookings have no Google booking event.
     */
    const shouldUpdateBookingCalendar = shouldRestoreAvailability;

    let bookingCalendarUpdated = !shouldUpdateBookingCalendar;

    let bookingCalendarError: string | null = null;

    const bookingCalendarPromise = async () => {
      if (!shouldUpdateBookingCalendar) {
        return;
      }

      await updateBookingCalendarEvent({
        bookingId: booking.id,
        bookingReference: booking.booking_reference,
        ownerName: customerName,
        ownerEmail: customer.email || null,
        dogName,
        dogBreed,
        startDate: booking.start_date,
        endDate: booking.end_date,
        bookingStatus: "Cancelled",
        paymentStatus: "Cancelled",
        totalCost: formatMoney(Number(booking.total_cost || 0)),
        depositAmount: formatMoney(Number(booking.deposit_amount || 0)),
        balanceAmount: formatMoney(Number(booking.balance_amount || 0)),
        notes: booking.notes,
      });

      bookingCalendarUpdated = true;
    };

    let cancellationEmailSent = false;

    let cancellationEmailError: string | null = null;

    const cancellationEmailPromise = async () => {
      if (!customer.email) {
        throw new Error("The customer does not have an email address.");
      }

      const emailResponse = await fetch(
        `${requestOrigin}/api/send-booking-cancelled-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bookingReference: booking.booking_reference,
            customerEmail: customer.email,
            customerName,
            dogName,
            startDate: formatDisplayDate(booking.start_date),
            endDate: formatDisplayDate(booking.end_date),
          }),
        },
      );

      if (!emailResponse.ok) {
        const responseText = await emailResponse.text();

        throw new Error(
          responseText ||
            "The cancellation email route returned an unsuccessful response.",
        );
      }

      cancellationEmailSent = true;
    };

    /*
     * Availability sync, booking-calendar update and
     * email delivery are independent follow-up tasks.
     */
    const [
      availabilityOperation,
      bookingCalendarOperation,
      cancellationEmailOperation,
    ] = await Promise.allSettled([
      availabilityCalendarPromise(),
      bookingCalendarPromise(),
      cancellationEmailPromise(),
    ]);

    if (availabilityOperation.status === "rejected") {
      const errorMessage =
        availabilityOperation.reason instanceof Error
          ? availabilityOperation.reason.message
          : "Unknown availability calendar error.";

      availabilityCalendarFailures.push({
        date: "booking date range",
        error: errorMessage,
      });

      console.error(
        "Availability calendar operation failed:",
        availabilityOperation.reason,
      );
    }

    if (bookingCalendarOperation.status === "rejected") {
      bookingCalendarError =
        bookingCalendarOperation.reason instanceof Error
          ? bookingCalendarOperation.reason.message
          : "Unknown Google booking calendar error.";

      console.error(
        `Booking calendar update failed for ${booking.booking_reference}:`,
        bookingCalendarOperation.reason,
      );
    }

    if (cancellationEmailOperation.status === "rejected") {
      cancellationEmailError =
        cancellationEmailOperation.reason instanceof Error
          ? cancellationEmailOperation.reason.message
          : "Unknown cancellation email error.";

      console.error(
        `Cancellation email failed for ${booking.booking_reference}:`,
        cancellationEmailOperation.reason,
      );
    }
    const availabilityCalendarSynced =
      availabilityCalendarFailures.length === 0;

    const followUpRequired =
      !availabilityCalendarSynced ||
      !bookingCalendarUpdated ||
      !cancellationEmailSent;

    const failedOperations: string[] = [];

    if (!availabilityCalendarSynced) {
      failedOperations.push(
        `${availabilityCalendarFailures.length} availability calendar operation(s)`,
      );
    }

    if (!bookingCalendarUpdated) {
      failedOperations.push("the Google booking calendar update");
    }

    if (!cancellationEmailSent) {
      failedOperations.push("the cancellation email");
    }

    return NextResponse.json(
      {
        success: true,
        databaseCancelled: true,
        followUpRequired,

        booking: {
          id: booking.id,
          bookingReference: booking.booking_reference,
          previousStatus,
          newStatus: "Cancelled",
          startDate: booking.start_date,
          endDate: booking.end_date,
        },

        availability: {
          restored: shouldRestoreAvailability,
          restoredDates: cancellationResult.restored_dates || 0,
          records: updatedAvailability,
          calendarSynced: availabilityCalendarSynced,
          calendarSyncedDates: availabilityCalendarSyncedDates,
          calendarFailures: availabilityCalendarFailures,
        },

        bookingCalendar: {
          required: shouldUpdateBookingCalendar,
          updated: bookingCalendarUpdated,
          error: bookingCalendarError,
        },

        email: {
          sent: cancellationEmailSent,
          error: cancellationEmailError,
        },

        message: followUpRequired
          ? `The booking was cancelled, but the following operation(s) could not be completed: ${failedOperations.join(
              ", ",
            )}.`
          : shouldRestoreAvailability
            ? "The booking was cancelled, availability was restored, both Google calendars were updated and the customer was notified."
            : "The Pending booking was cancelled and the customer was notified.",
      },
      {
        status: followUpRequired ? 207 : 200,
      },
    );
  } catch (error) {
    console.error("Booking cancellation failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to cancel the booking.",
      },
      {
        status: 500,
      },
    );
  }
}
