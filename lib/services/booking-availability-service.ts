import { supabase } from "@/lib/supabase";

export type BookingDateRange = {
  startDate: string;
  endDate: string;
};

export type AvailabilitySyncFailure = {
  date: string;
  error: string;
};

export type AdjustBookingAvailabilityResult = {
  success: boolean;
  databaseUpdated: boolean;
  syncedDates: number;
  syncFailures: AvailabilitySyncFailure[];
  error?: string;
};

type AvailabilityRecord = {
  id: string;
  date: string;
  available: boolean;
  total_spaces: number;
  spaces_available: number;
  notes: string | null;
};

export async function adjustBookingAvailability(
  booking: BookingDateRange,
  change: number
): Promise<AdjustBookingAvailabilityResult> {
  const { error: availabilityError } =
    await supabase.rpc(
      "adjust_availability_for_booking",
      {
        p_start_date: booking.startDate,
        p_end_date: booking.endDate,
        p_change: change,
      }
    );

  if (availabilityError) {
    return {
      success: false,
      databaseUpdated: false,
      syncedDates: 0,
      syncFailures: [],
      error: availabilityError.message,
    };
  }

  const {
    data: updatedAvailability,
    error: loadError,
  } = await supabase
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
    .gte("date", booking.startDate)
    .lt("date", booking.endDate)
    .order("date", { ascending: true });

  if (loadError) {
    return {
      success: false,
      databaseUpdated: true,
      syncedDates: 0,
      syncFailures: [],
      error:
        `Availability was updated, but the affected dates could not be loaded: ${loadError.message}`,
    };
  }

  const availabilityRecords =
    (updatedAvailability || []) as AvailabilityRecord[];

  const syncFailures: AvailabilitySyncFailure[] = [];

  let syncedDates = 0;

  for (const availabilityRecord of availabilityRecords) {
    try {
      const response = await fetch(
        "/api/google/sync-availability-event",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            availabilityId: availabilityRecord.id,
            date: availabilityRecord.date,
            available: availabilityRecord.available,
            totalSpaces:
              availabilityRecord.total_spaces,
            spacesAvailable:
              availabilityRecord.spaces_available,
            notes: availabilityRecord.notes,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();

        syncFailures.push({
          date: availabilityRecord.date,
          error:
            errorText ||
            "Google Calendar returned an unsuccessful response.",
        });

        continue;
      }

      syncedDates += 1;
    } catch (error) {
      syncFailures.push({
        date: availabilityRecord.date,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Google Calendar error.",
      });
    }
  }

  if (syncFailures.length > 0) {
    return {
      success: false,
      databaseUpdated: true,
      syncedDates,
      syncFailures,
      error:
        `Availability was updated, but ${syncFailures.length} availability calendar event(s) could not be synced.`,
    };
  }

  return {
    success: true,
    databaseUpdated: true,
    syncedDates,
    syncFailures: [],
  };
}