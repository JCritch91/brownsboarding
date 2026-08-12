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
      balancePaidDate,
      balanceAmount,
      invoiceNumber,
    } = body;

    if (!customerEmail) {
      return NextResponse.json(
        {
          error: "Customer email is missing.",
        },
        {
          status: 400,
        }
      );
    }

    if (!bookingReference) {
      return NextResponse.json(
        {
          error: "Booking reference is missing.",
        },
        {
          status: 400,
        }
      );
    }

    const bodyContent = `
      <p>Hi ${customerName || "there"},</p>

      <p>
        Thank you. We can confirm that we have received the remaining balance
        for ${dogName}'s booking.
      </p>

      <p>
        <strong>Booking reference:</strong><br />
        ${bookingReference}
      </p>

      <p>
        <strong>Invoice number:</strong><br />
        ${invoiceNumber}
      </p>

      <p>
        <strong>Booking dates:</strong><br />
        ${startDate} to ${endDate}
      </p>

      <p>
        <strong>Balance received:</strong><br />
        ${balanceAmount}
      </p>

      <p>
        <strong>Balance paid date:</strong><br />
        ${balancePaidDate}
      </p>

      <p>
        Your booking is now fully paid.
      </p>

      <p>
        Please include your booking reference when contacting Browns Boarding
        about this stay.
      </p>

      <p>
        Thank you,<br />
        Browns Boarding
      </p>
    `;

    const emailBody = createEmailTemplate(
      "Full Balance Received",
      bodyContent
    );

    await sendGmailEmail({
      to: customerEmail,
      subject: `Full balance received - ${bookingReference}`,
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
            : "Unable to send balance received email.",
      },
      {
        status: 500,
      }
    );
  }
}