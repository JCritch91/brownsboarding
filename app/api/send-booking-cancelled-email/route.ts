import { NextResponse } from "next/server";
import { sendGmailEmail } from "@/lib/gmail";
import { createEmailTemplate } from "@/lib/email-template";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      bookingReference,
      customerEmail,
      customerName,
      dogName,
      startDate,
      endDate,
    } = body;

    if (!customerEmail) {
      return NextResponse.json(
        { error: "Customer email is missing." },
        { status: 400 }
      );
    }

    const bodyContent = `
      <p>Hi ${customerName},</p>

      <p>
        We can confirm that your booking has been cancelled.
      </p>

      <p>
        <strong>Booking reference:</strong><br />
        ${bookingReference}
      </p>

      <p>
        <strong>Dog:</strong><br />
        ${dogName}
      </p>

      <p>
        <strong>Booking dates:</strong><br />
        ${startDate} to ${endDate}
      </p>

      <p>
        If you cancelled within the deposit forfeiture period,
        the Browns Boarding cancellation policy will apply.
      </p>

      <p>
        Thank you,<br />
        Browns Boarding
      </p>
    `;

    const emailBody = createEmailTemplate(
      "Booking Cancelled",
      bodyContent
    );

    await sendGmailEmail({
      to: customerEmail,
      subject: `Booking cancelled - ${bookingReference}`,
      html: emailBody,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to send cancellation email.",
      },
      { status: 500 }
    );
  }
}