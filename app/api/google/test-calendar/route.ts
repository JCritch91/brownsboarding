import { NextResponse } from "next/server";
import { createGoogleBookingEvent } from "@/lib/google-calendar";

export async function GET() {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    const startDate = tomorrow.toISOString().split("T")[0];
    const endDate = dayAfterTomorrow.toISOString().split("T")[0];

    const event = await createGoogleBookingEvent({
      bookingId: "test-booking",
      bookingReference: "TEST-001",
      ownerName: "Browns Boarding",
      ownerEmail: null,
      dogName: "Calendar Test",
      dogBreed: null,
      startDate,
      endDate,
      bookingStatus: "Test",
      paymentStatus: "Test",
      notes: "Test event created by the Browns Boarding website.",
    });

    return NextResponse.json({
      success: true,
      message: "Google Calendar test event created.",
      eventId: event.id,
      eventLink: event.htmlLink,
    });
  } catch (error) {
    console.error("Google Calendar test error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to create Google Calendar test event.",
      },
      { status: 500 }
    );
  }
}
