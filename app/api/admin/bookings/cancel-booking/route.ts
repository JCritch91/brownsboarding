import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { updateGoogleBookingEvent } from "@/lib/google-calendar";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatMoney(amount: number | null) {
  if (amount === null || amount === undefined) {
    return null;
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

function formatDisplayDate(dateString: string) {
  const [year, month, day] = dateString.split("-");

  return `${day}/${month}/${year}`;
}

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
        }
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
        }
      );
    }

    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json(
        {
          error: "Booking ID is missing.",
        },
        {
          status: 400,
        }
      );
    }

    const { data: booking, error: bookingLoadError } =
      await supabaseAdmin
        .from("bookings")
        .select(
          `
          id,
          owner_id,
          booking_reference,
          start_date,
          end_date,
          status,
          notes,
          total_cost,
          deposit_amount,
          balance_amount,
          dogs (
            name,
            breed
          )
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

    if (booking.owner_id !== user.id) {
      return NextResponse.json(
        {
          error: "You do not have permission to cancel this booking.",
        },
        {
          status: 403,
        }
      );
    }

    if (booking.status === "Cancelled") {
      return NextResponse.json({
        success: true,
        message: "This booking has already been cancelled.",
      });
    }

    const cancellableStatuses = [
      "Pending",
      "Deposit Pending",
      "Balance Pending",
      "Balance Paid",
    ];

    if (!cancellableStatuses.includes(booking.status)) {
      return NextResponse.json(
        {
          error: `A booking with status "${booking.status}" cannot be cancelled.`,
        },
        {
          status: 400,
        }
      );
    }

const previousStatus = booking.status;

const shouldRestoreAvailability = [
  "Deposit Pending",
  "Balance Pending",
  "Balance Paid",
].includes(previousStatus);

let availabilityCalendarSyncFailures = 0;

if (shouldRestoreAvailability) {
  const { data: availabilityRecords, error: availabilityLoadError } =
    await supabaseAdmin
      .from("availability")
      .select(
        "id, date, available, total_spaces, spaces_available, notes"
      )
      .gte("date", booking.start_date)
      .lt("date", booking.end_date)
      .order("date", { ascending: true });

  if (availabilityLoadError) {
    return NextResponse.json(
      {
        error: `The booking could not be cancelled because availability could not be loaded: ${availabilityLoadError.message}`,
      },
      {
        status: 500,
      }
    );
  }

  for (const availabilityRecord of availabilityRecords || []) {
    const restoredSpaces = Math.min(
      availabilityRecord.total_spaces,
      availabilityRecord.spaces_available + 1
    );

    const { error: availabilityUpdateError } =
      await supabaseAdmin
        .from("availability")
        .update({
          spaces_available: restoredSpaces,
          updated_at: new Date().toISOString(),
        })
        .eq("id", availabilityRecord.id);

    if (availabilityUpdateError) {
      return NextResponse.json(
        {
          error: `Availability could not be restored for ${availabilityRecord.date}: ${availabilityUpdateError.message}`,
        },
        {
          status: 500,
        }
      );
    }
    try {
      const calendarResponse = await fetch(
        `${new URL(request.url).origin}/api/google/sync-availability-event`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            availabilityId: availabilityRecord.id,
            date: availabilityRecord.date,
            available: availabilityRecord.available,
            totalSpaces: availabilityRecord.total_spaces,
            spacesAvailable: restoredSpaces,
            notes: availabilityRecord.notes,
          }),
        }
      );

      if (!calendarResponse.ok) {
        availabilityCalendarSyncFailures += 1;

        const calendarErrorText = await calendarResponse.text();

        console.error(
          `Google availability calendar sync failed for ${availabilityRecord.date}:`,
          calendarErrorText
        );
      }
    } catch (calendarError) {
      availabilityCalendarSyncFailures += 1;

      console.error(
        `Google availability calendar sync failed for ${availabilityRecord.date}:`,
        calendarError
      );
    }
  }
}

  const { error: cancellationError } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "Cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .eq("status", previousStatus);

    if (cancellationError) {
      return NextResponse.json(
        {
          error: cancellationError.message,
        },
        {
          status: 500,
        }
      );
    }

    let bookingCalendarSyncFailed = false;

if (shouldRestoreAvailability) {
  try {
    const { data: trackingRecord, error: trackingError } =
      await supabaseAdmin
        .from("google_calendar_events")
        .select("google_event_id")
        .eq("booking_id", booking.id)
        .maybeSingle();

    if (trackingError) {
      throw new Error(trackingError.message);
    }

    if (trackingRecord) {
      const { data: customerProfile, error: profileError } =
        await supabaseAdmin
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("id", booking.owner_id)
          .maybeSingle();

      if (profileError) {
        throw new Error(profileError.message);
      }

      const ownerName =
        `${customerProfile?.first_name || ""} ${
          customerProfile?.last_name || ""
        }`.trim() ||
        customerProfile?.email ||
        "Customer";

      const dogDetails = Array.isArray(booking.dogs)
        ? booking.dogs[0]
        : booking.dogs;

      await updateGoogleBookingEvent(
        trackingRecord.google_event_id,
        {
          bookingId: booking.id,
          bookingReference: booking.booking_reference,
          ownerName,
          ownerEmail: customerProfile?.email || null,
          dogName: dogDetails?.name || "Dog",
          dogBreed: dogDetails?.breed || null,
          startDate: booking.start_date,
          endDate: booking.end_date,
          bookingStatus: "Cancelled",
          paymentStatus: "Cancelled",
          totalCost: formatMoney(booking.total_cost),
          depositAmount: formatMoney(booking.deposit_amount),
          balanceAmount: formatMoney(booking.balance_amount),
          notes: booking.notes,
        }
      );
    }
  } catch (calendarError) {
    bookingCalendarSyncFailed = true;

    console.error(
      "Google booking calendar cancellation sync failed:",
      calendarError
    );
  }
}

let cancellationEmailFailed = false;

try {
  const { data: customerProfile, error: profileError } =
    await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", booking.owner_id)
      .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!customerProfile?.email) {
    throw new Error("Customer email address is missing.");
  }

  const customerName =
    `${customerProfile.first_name || ""} ${
      customerProfile.last_name || ""
    }`.trim() || "Customer";

  const dogDetails = Array.isArray(booking.dogs)
    ? booking.dogs[0]
    : booking.dogs;

  const emailResponse = await fetch(
    `${new URL(request.url).origin}/api/send-booking-cancelled-email`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bookingReference: booking.booking_reference,
        customerEmail: customerProfile.email,
        customerName,
        dogName: dogDetails?.name || "your dog",
        startDate: formatDisplayDate(booking.start_date),
        endDate: formatDisplayDate(booking.end_date),
      }),
    }
  );

  if (!emailResponse.ok) {
    const emailErrorText = await emailResponse.text();

    throw new Error(
      emailErrorText || "Cancellation email could not be sent."
    );
  }
} catch (emailError) {
  cancellationEmailFailed = true;

  console.error(
    "Customer cancellation email failed:",
    emailError
  );
}

return NextResponse.json({
  success: true,
  message:
    availabilityCalendarSyncFailures > 0 ||
    bookingCalendarSyncFailed ||
    cancellationEmailFailed
      ? "Booking cancelled successfully, but one or more follow-up updates could not be completed."
      : shouldRestoreAvailability
        ? "Booking cancelled, availability restored, Google Calendar updated, and confirmation email sent."
        : "Pending booking cancelled and confirmation email sent.",
  previousStatus,
  bookingReference: booking.booking_reference,
  availabilityCalendarSyncFailures,
  bookingCalendarSyncFailed,
  cancellationEmailFailed,
});

  } catch (error) {
    console.error("Customer booking cancellation failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to cancel the booking.",
      },
      {
        status: 500,
      }
    );
  }
}