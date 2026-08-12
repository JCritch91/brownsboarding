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
      totalCost,
      depositAmount,
      balanceAmount,
      shortNoticeBooking,
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

    const paymentText = shortNoticeBooking
      ? `
          <p>
            This booking starts within 14 days, so no deposit is required.
          </p>

          <p>
            <strong>Full balance due immediately:</strong><br />
            ${totalCost}
          </p>
        `
      : `
          <p>
            <strong>Total stay cost:</strong><br />
            ${totalCost}
          </p>

          <p>
            <strong>Deposit payable now:</strong><br />
            ${depositAmount}
          </p>

          <p>
            <strong>Remaining balance due by ${getBalanceDueDate(
              startDate
            )}:</strong><br />
            ${balanceAmount}
          </p>
        `;

    const bodyContent = `
      <p>Hi ${customerName || "there"},</p>

      <p>
        Your booking for ${dogName} has been confirmed.
      </p>

      <p>
        <strong>Booking reference:</strong><br />
        ${bookingReference}
      </p>

      <p>
        <strong>Booking dates:</strong><br />
        ${startDate} to ${endDate}
      </p>

      ${paymentText}

      <p>
        Please include your booking reference when contacting Browns Boarding
        about this stay.
      </p>

      <p>
        Please arrange payment using the payment details provided by Browns
        Boarding.
      </p>

      <p>
        Thank you,<br />
        Browns Boarding
      </p>
    `;

    const emailBody = createEmailTemplate(
      "Booking Confirmed",
      bodyContent
    );

    await sendGmailEmail({
      to: customerEmail,
      subject: `Booking confirmed - ${bookingReference}`,
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
            : "Unable to send booking confirmation email.",
      },
      {
        status: 500,
      }
    );
  }
}