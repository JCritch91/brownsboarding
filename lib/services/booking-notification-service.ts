import type {
  BookingConfirmationEmailPayload,
} from "@/lib/services/booking-payloads";

export type BookingNotificationResult = {
  success: boolean;
  error?: string;
};

async function getResponseError(
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

export async function sendBookingConfirmationNotification(
  payload: BookingConfirmationEmailPayload
): Promise<BookingNotificationResult> {
  try {
    const response = await fetch(
      "/api/send-booking-confirmation-email",
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
        error: await getResponseError(
          response,
          "The booking confirmation email could not be sent."
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
          : "The booking confirmation email could not be sent.",
    };
  }
}