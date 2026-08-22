import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { formatDisplayDate, formatMoney, formatName } from "@/lib/helpers";

import { syncAvailabilityCalendarEvent } from "@/lib/services/availability-calendar-sync-service";
import { updateBookingCalendarEvent } from "@/lib/services/booking-calendar-service";
import { sendBookingCancellationEmail } from "@/lib/services/booking-cancellation-email-service";

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

type CancelBookingRequest = {
  bookingId?: unknown;
};

type AvailabilityCalendarFailure = {
  date: string;
  error: string;
};

type CapacityAllocation = {
  allocation_date: string;
  allocation_type: "standard" | "shared";
  space_units: number;
};

type CancelBookingResult = {
  booking_id: string;
  booking_reference: string;
  previous_status: string;
  new_status: string;
  booking_type: "boarding" | "daycare";
  start_date: string;
  end_date: string;
  availability_restored: boolean;
  restored_dates: number;
  standard_allocations_released: number;
  shared_allocations_released: number;
};

const CANCELLABLE_STATUSES = [
  "Pending",
  "Deposit Pending",
  "Balance Pending",
  "Balance Paid",
];

const CAPACITY_CONSUMING_STATUSES = [
  "Deposit Pending",
  "Balance Pending",
  "Balance Paid",
];

function getCancellationErrorResponse(errorMessage: string) {
  if (errorMessage.includes("BOOKING_ID_REQUIRED")) {
    return {
      error: "Booking ID is missing.",
      status: 400,
    };
  }

  if (errorMessage.includes("BOOKING_NOT_FOUND")) {
    return {
      error: "The booking could not be found.",
      status: 404,
    };
  }

  if (errorMessage.includes("BOOKING_ALREADY_CANCELLED")) {
    return {
      error: "This booking has already been cancelled.",
      status: 409,
    };
  }

  if (errorMessage.includes("COMPLETED_BOOKING_CANNOT_BE_CANCELLED")) {
    return {
      error: "A completed booking cannot be cancelled.",
      status: 409,
    };
  }

  if (errorMessage.includes("BOOKING_STATUS_CANNOT_BE_CANCELLED")) {
    return {
      error: "This booking cannot be cancelled in its current status.",
      status: 409,
    };
  }

  if (errorMessage.includes("CAPACITY_ALLOCATIONS_MISSING")) {
    return {
      error:
        "The booking capacity records are missing, so availability could not be restored safely.",
      status: 409,
    };
  }

  if (errorMessage.includes("AVAILABILITY_RESTORE_FAILED")) {
    return {
      error: "One or more availability records could not be restored.",
      status: 500,
    };
  }

  if (errorMessage.includes("INVALID_CAPACITY_ALLOCATION_TYPE")) {
    return {
      error: "The booking contains an invalid capacity allocation.",
      status: 500,
    };
  }

  if (errorMessage.includes("BOOKING_CANCELLATION_FAILED")) {
    return {
      error:
        "The booking status changed before cancellation could be completed. Refresh the page and try again.",
      status: 409,
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

    if (!profile || !profile.active) {
      return NextResponse.json(
        {
          error: "Your account is inactive or could not be found.",
        },
        {
          status: 403,
        },
      );
    }

    let body: CancelBookingRequest;

    try {
      body = (await request.json()) as CancelBookingRequest;
    } catch {
      return NextResponse.json(
        {
          error: "The cancellation request is invalid.",
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
          owner_id,
          dog_id,
          booking_type,
          daycare_session,
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
          error: "The booking could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    const activeAdministrator = profile.active && profile.is_admin === true;

    if (booking.owner_id !== user.id && !activeAdministrator) {
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

    if (!CANCELLABLE_STATUSES.includes(booking.status)) {
      return NextResponse.json(
        {
          error: "This booking cannot be cancelled in its current status.",
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

    const { data: bookingDogLinkData, error: bookingDogsLoadError } =
      await supabaseAdmin
        .from("booking_dogs")
        .select(
          `
        dog_id,
        sort_order,
        dogs (
          id,
          owner_id,
          name,
          breed
        )
        `,
        )
        .eq("booking_id", booking.id)
        .order("sort_order", {
          ascending: true,
        });

    if (bookingDogsLoadError) {
      return NextResponse.json(
        {
          error: bookingDogsLoadError.message,
        },
        {
          status: 500,
        },
      );
    }

    const linkedDogs = (bookingDogLinkData || [])
      .map((bookingDogLink) =>
        Array.isArray(bookingDogLink.dogs)
          ? bookingDogLink.dogs[0]
          : bookingDogLink.dogs,
      )
      .filter((dog): dog is NonNullable<typeof dog> => Boolean(dog));

    if (linkedDogs.length === 0) {
      const { data: legacyDog, error: legacyDogError } = await supabaseAdmin
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

      if (legacyDogError) {
        return NextResponse.json(
          {
            error: legacyDogError.message,
          },
          {
            status: 500,
          },
        );
      }

      if (!legacyDog) {
        return NextResponse.json(
          {
            error: "The dogs associated with this booking could not be found.",
          },
          {
            status: 404,
          },
        );
      }

      linkedDogs.push(legacyDog);
    }

    const { data: capacityAllocationData, error: capacityAllocationsError } =
      await supabaseAdmin
        .from("booking_capacity_allocations")
        .select(
          `
        allocation_date,
        allocation_type,
        space_units
        `,
        )
        .eq("booking_id", booking.id)
        .order("allocation_date", {
          ascending: true,
        });

    if (capacityAllocationsError) {
      return NextResponse.json(
        {
          error: capacityAllocationsError.message,
        },
        {
          status: 500,
        },
      );
    }

    const capacityAllocations = (capacityAllocationData ||
      []) as CapacityAllocation[];

    const standardAllocationDates = capacityAllocations
      .filter((allocation) => allocation.allocation_type === "standard")
      .map((allocation) => String(allocation.allocation_date));

    const sharedAllocationDates = capacityAllocations
      .filter((allocation) => allocation.allocation_type === "shared")
      .map((allocation) => String(allocation.allocation_date));

    const { data: cancellationRows, error: cancellationError } =
      await supabaseAdmin.rpc("cancel_booking_v2_atomic", {
        p_booking_id: booking.id,
      });

    if (cancellationError) {
      console.error(
        "Atomic V2 booking cancellation failed:",
        cancellationError,
      );

      const errorResponse = getCancellationErrorResponse(
        cancellationError.message || "The booking could not be cancelled.",
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

    const cancellationResult = (
      Array.isArray(cancellationRows) ? cancellationRows[0] : cancellationRows
    ) as CancelBookingResult | null;

    if (!cancellationResult) {
      return NextResponse.json(
        {
          error:
            "The cancellation completed without returning a booking result.",
        },
        {
          status: 500,
        },
      );
    }

    const bookingConsumedCapacity = CAPACITY_CONSUMING_STATUSES.includes(
      cancellationResult.previous_status,
    );

    let updatedAvailability: Array<{
      id: string;
      date: string;
      available: boolean;
      total_spaces: number;
      spaces_available: number;
      notes: string | null;
    }> = [];

    if (standardAllocationDates.length > 0) {
      const { data: availabilityData, error: updatedAvailabilityError } =
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
          .in("date", standardAllocationDates)
          .order("date", {
            ascending: true,
          });

      if (updatedAvailabilityError) {
        return NextResponse.json(
          {
            success: true,
            databaseCancelled: true,
            followUpRequired: true,
            booking: {
              id: booking.id,
              bookingReference: booking.booking_reference,
              previousStatus: cancellationResult.previous_status,
              newStatus: cancellationResult.new_status,
              bookingType: booking.booking_type,
              startDate: booking.start_date,
              endDate: booking.end_date,
            },
            error: `The booking was cancelled, but the restored availability records could not be loaded: ${updatedAvailabilityError.message}`,
          },
          {
            status: 207,
          },
        );
      }

      updatedAvailability = availabilityData || [];
    }

    const availabilityCalendarFailures: AvailabilityCalendarFailure[] = [];

    let availabilityCalendarSyncedDates = 0;

    const availabilityCalendarResults = await Promise.allSettled(
      updatedAvailability.map(async (availabilityRecord) => {
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
      const availabilityRecord = updatedAvailability[index];

      if (calendarResult.status === "fulfilled") {
        availabilityCalendarSyncedDates += 1;
        return;
      }

      const errorMessage =
        calendarResult.reason instanceof Error
          ? calendarResult.reason.message
          : "Unknown Google Availability Calendar error.";

      availabilityCalendarFailures.push({
        date: availabilityRecord?.date || "unknown date",
        error: errorMessage,
      });

      console.error(
        `Availability calendar restoration failed for ${
          availabilityRecord?.date || "unknown date"
        }:`,
        calendarResult.reason,
      );
    });

    const customerName =
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
      customer.email ||
      "Customer";

    const dogNames = linkedDogs
      .map((dog) => formatName(String(dog.name || "")))
      .filter(Boolean);

    const dogName =
      dogNames.length === 0
        ? "Dog"
        : dogNames.length === 1
          ? dogNames[0]
          : `${dogNames[0]} and ${dogNames[1]}`;

    const dogBreeds = linkedDogs
      .map((dog) => (dog.breed ? formatName(String(dog.breed)) : ""))
      .filter(Boolean);

    const dogBreed = dogBreeds.length > 0 ? dogBreeds.join(", ") : null;

    const bookingCalendarOperation = async () => {
      if (!bookingConsumedCapacity) {
        return;
      }

      await updateBookingCalendarEvent({
        bookingId: booking.id,
        bookingReference: booking.booking_reference,
        ownerName: customerName,
        ownerEmail: customer.email || null,
        dogName,
        dogBreed,
        bookingType: booking.booking_type,
        daycareSession: booking.daycare_session,
        startDate: booking.start_date,
        endDate: booking.end_date,
        bookingStatus: "Cancelled",
        paymentStatus: "Cancelled",
        totalCost: formatMoney(Number(booking.total_cost || 0)),
        depositAmount: formatMoney(Number(booking.deposit_amount || 0)),
        balanceAmount: formatMoney(Number(booking.balance_amount || 0)),
        notes: booking.notes,
      });
    };

    const cancellationEmailOperation = async () => {
      if (!customer.email) {
        throw new Error("The customer does not have an email address.");
      }

      await sendBookingCancellationEmail({
        bookingReference: booking.booking_reference,
        customerEmail: customer.email,
        customerName,
        dogName,
        bookingType: booking.booking_type,
        daycareSession: booking.daycare_session,
        startDate: formatDisplayDate(booking.start_date),
        endDate: formatDisplayDate(booking.end_date),
      });
    };

    const [bookingCalendarResult, cancellationEmailResult] =
      await Promise.allSettled([
        bookingCalendarOperation(),
        cancellationEmailOperation(),
      ]);

    const bookingCalendarUpdated = bookingCalendarResult.status === "fulfilled";

    const cancellationEmailSent =
      cancellationEmailResult.status === "fulfilled";

    const bookingCalendarError =
      bookingCalendarResult.status === "rejected"
        ? bookingCalendarResult.reason instanceof Error
          ? bookingCalendarResult.reason.message
          : "Unknown Google Booking Calendar error."
        : null;

    const cancellationEmailError =
      cancellationEmailResult.status === "rejected"
        ? cancellationEmailResult.reason instanceof Error
          ? cancellationEmailResult.reason.message
          : "Unknown cancellation email error."
        : null;

    if (!bookingCalendarUpdated) {
      console.error(
        `Booking calendar cancellation update failed for ${booking.booking_reference}:`,
        bookingCalendarResult.status === "rejected"
          ? bookingCalendarResult.reason
          : bookingCalendarError,
      );
    }

    if (!cancellationEmailSent) {
      console.error(
        `Booking cancellation email failed for ${booking.booking_reference}:`,
        cancellationEmailResult.status === "rejected"
          ? cancellationEmailResult.reason
          : cancellationEmailError,
      );
    }

    const availabilityCalendarSynced =
      availabilityCalendarFailures.length === 0;

    const bookingCalendarRequired = bookingConsumedCapacity;

    const followUpRequired =
      !availabilityCalendarSynced ||
      (bookingCalendarRequired && !bookingCalendarUpdated) ||
      !cancellationEmailSent;

    const failedOperations: string[] = [];

    if (!availabilityCalendarSynced) {
      failedOperations.push(
        `${availabilityCalendarFailures.length} availability calendar event(s)`,
      );
    }

    if (bookingCalendarRequired && !bookingCalendarUpdated) {
      failedOperations.push("the Google booking calendar update");
    }

    if (!cancellationEmailSent) {
      failedOperations.push("the customer cancellation email");
    }

    let successMessage: string;

    if (followUpRequired) {
      successMessage = `The booking was cancelled, but the following operation(s) could not be completed: ${failedOperations.join(
        ", ",
      )}.`;
    } else if (bookingConsumedCapacity) {
      successMessage =
        "The booking was cancelled, its capacity allocations were released, the required Google calendars were updated and the customer was notified.";
    } else {
      successMessage =
        "The Pending booking was cancelled and the customer was notified.";
    }

    return NextResponse.json(
      {
        success: true,
        databaseCancelled: true,
        followUpRequired,
        booking: {
          id: cancellationResult.booking_id,
          bookingReference: cancellationResult.booking_reference,
          previousStatus: cancellationResult.previous_status,
          newStatus: cancellationResult.new_status,
          bookingType: cancellationResult.booking_type,
          startDate: cancellationResult.start_date,
          endDate: cancellationResult.end_date,
        },
        availability: {
          restored: Boolean(cancellationResult.availability_restored),
          restoredDates: Number(cancellationResult.restored_dates || 0),
          standardAllocationsReleased: Number(
            cancellationResult.standard_allocations_released || 0,
          ),
          sharedAllocationsReleased: Number(
            cancellationResult.shared_allocations_released || 0,
          ),
          sharedDates: sharedAllocationDates,
          records: updatedAvailability,
          calendarSynced: availabilityCalendarSynced,
          calendarSyncedDates: availabilityCalendarSyncedDates,
          calendarFailures: availabilityCalendarFailures,
        },
        bookingCalendar: {
          required: bookingCalendarRequired,
          updated: bookingCalendarRequired ? bookingCalendarUpdated : false,
          error: bookingCalendarRequired ? bookingCalendarError : null,
        },
        email: {
          sent: cancellationEmailSent,
          error: cancellationEmailError,
        },
        message: successMessage,
      },
      {
        status: followUpRequired ? 207 : 200,
      },
    );
  } catch (error) {
    console.error("Booking Engine V2 cancellation failed:", error);

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
