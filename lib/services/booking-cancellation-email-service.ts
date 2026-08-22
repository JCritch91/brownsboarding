import { createEmailTemplate } from "@/lib/email-template";
import { sendGmailEmail } from "@/lib/gmail";

import type { BookingType, DaycareSessionType } from "@/types/booking";

export type SendBookingCancellationEmailInput = {
  bookingReference: string;
  customerEmail: string;
  customerName: string;
  dogName: string;
  bookingType: BookingType;
  daycareSession: DaycareSessionType | null;
  startDate: string;
  endDate: string;
};

export type SendBookingCancellationEmailResult = {
  success: true;
  sent: true;
  recipient: string;
  message: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isValidDisplayDate(value: string) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    return false;
  }

  const [dayText, monthText, yearText] = value.split("/");

  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateRequiredText(
  value: unknown,
  fieldName: string,
): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is missing.`);
  }
}

function validateInput(input: SendBookingCancellationEmailInput) {
  validateRequiredText(input.bookingReference, "Booking reference");

  validateRequiredText(input.customerEmail, "Customer email");

  validateRequiredText(input.customerName, "Customer name");

  validateRequiredText(input.dogName, "Dog name");

  if (input.bookingType !== "boarding" && input.bookingType !== "daycare") {
    throw new Error("The booking type is invalid.");
  }

  if (input.bookingType === "boarding" && input.daycareSession !== null) {
    throw new Error("A Boarding booking cannot contain a Daycare session.");
  }

  if (
    input.bookingType === "daycare" &&
    input.daycareSession !== "full_day" &&
    input.daycareSession !== "half_day"
  ) {
    throw new Error("The Doggy Day Care session is invalid.");
  }

  if (
    typeof input.startDate !== "string" ||
    !isValidDisplayDate(input.startDate)
  ) {
    throw new Error("The booking start date is invalid.");
  }

  if (typeof input.endDate !== "string" || !isValidDisplayDate(input.endDate)) {
    throw new Error("The booking end date is invalid.");
  }

  if (input.bookingType === "daycare" && input.startDate !== input.endDate) {
    throw new Error(
      "A Doggy Day Care booking must start and end on the same date.",
    );
  }
}

function getServiceName({
  bookingType,
  daycareSession,
}: {
  bookingType: BookingType;
  daycareSession: DaycareSessionType | null;
}) {
  if (bookingType === "boarding") {
    return "Home Boarding";
  }

  return daycareSession === "half_day"
    ? "Doggy Day Care, Half Day"
    : "Doggy Day Care, Full Day";
}

function getDateLabel(bookingType: BookingType) {
  return bookingType === "daycare" ? "Attendance date" : "Booking dates";
}

function getFormattedDates({
  bookingType,
  startDate,
  endDate,
}: {
  bookingType: BookingType;
  startDate: string;
  endDate: string;
}) {
  return bookingType === "daycare" ? startDate : `${startDate} to ${endDate}`;
}

export async function sendBookingCancellationEmail(
  input: SendBookingCancellationEmailInput,
): Promise<SendBookingCancellationEmailResult> {
  validateInput(input);

  const bookingReference = input.bookingReference.trim();

  const customerEmail = input.customerEmail.trim();

  const customerName = escapeHtml(input.customerName.trim());

  const dogName = escapeHtml(input.dogName.trim());

  const serviceName = escapeHtml(
    getServiceName({
      bookingType: input.bookingType,
      daycareSession: input.daycareSession,
    }),
  );

  const dateLabel = escapeHtml(getDateLabel(input.bookingType));

  const formattedDates = escapeHtml(
    getFormattedDates({
      bookingType: input.bookingType,
      startDate: input.startDate,
      endDate: input.endDate,
    }),
  );

  const bodyContent = `
    <p>Hi ${customerName},</p>

    <p>
      We can confirm that the booking for ${dogName} has been cancelled.
    </p>

    <p>
      <strong>Booking reference:</strong><br />
      ${escapeHtml(bookingReference)}
    </p>

    <p>
      <strong>Service:</strong><br />
      ${serviceName}
    </p>

    <p>
      <strong>${dateLabel}:</strong><br />
      ${formattedDates}
    </p>

    <p>
      If the booking was cancelled within 14 days of the start date,
      the Browns Boarding cancellation policy will apply.
    </p>

    <p>
      Thank you,<br />
      Browns Boarding
    </p>
  `;

  const emailBody = createEmailTemplate("Booking Cancelled", bodyContent);

  await sendGmailEmail({
    to: customerEmail,
    subject: `Booking cancelled - ${bookingReference}`,
    html: emailBody,
  });

  return {
    success: true,
    sent: true,
    recipient: customerEmail,
    message: "The booking cancellation email was sent successfully.",
  };
}
