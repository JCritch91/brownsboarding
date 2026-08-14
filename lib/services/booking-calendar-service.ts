import type {
  BookingCalendarPayload,
} from "@/lib/services/booking-payloads";

export type BookingCalendarResult = {
  success: boolean;
  error?: string;
};

async function getCalendarResponseError(
  response: Response,
  fallbackMessage: string
) {
  const responseText = await response.text();

  if (!responseText) {
    return fallbackMessage;
  }

  try {
    const responseData = JSON.parse(responseText);

    return responseData.error || fallbackMessage;
  } catch {
    return responseText;
  }
}

export async function createBookingCalendarEvent(
  payload: BookingCalendarPayload
): Promise<BookingCalendarResult> {
  try {
    const response = await fetch(
      "/api/google/create-booking-event",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      return {
        success: false,
        error: await getCalendarResponseError(
          response,
          "The Google Calendar event could not be created."
        ),
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "The Google Calendar event could not be created.",
    };
  }
}