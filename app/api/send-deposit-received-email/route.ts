import { NextResponse } from "next/server";

import { sendGmailEmail } from "@/lib/gmail";
import { createEmailTemplate } from "@/lib/email-template";

function getBalanceDueDate(startDate: string) {
  const [day, month, year] = startDate.split("/").map(Number);

  const dueDate = new Date(year, month - 1, day);
  dueDate.setDate(dueDate.getDate() - 14);

  const dueDay = String(dueDate.getDate()).padStart(2, "0");
  const dueMonth = String(dueDate.getMonth() + 1).padStart(2, "0");
  const dueYear = dueDate.getFullYear();

  return `${dueDay}/${dueMonth}/${dueYear}`;
}

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
      depositPaidDate,
      invoiceNumber,
      depositAmount,
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
        Thank you. We can confirm that we have received the deposit for
        ${dogName}'s booking.
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
        <strong>Deposit received:</strong><br />
        ${depositAmount}
      </p>

      <p>
        <strong>Deposit paid date:</strong><br />
        ${depositPaidDate}
      </p>

      <p>
        The remaining balance is due by
        <strong>${getBalanceDueDate(startDate)}</strong>.
      </p>

      <p>
        We will send a reminder before the balance due date.
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
      "Deposit Received",
      bodyContent
    );

    await sendGmailEmail({
      to: customerEmail,
      subject: `Deposit received - ${bookingReference}`,
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
            : "Unable to send deposit received email.",
      },
      {
        status: 500,
      }
    );
  }
}