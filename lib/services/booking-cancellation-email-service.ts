import { createEmailTemplate } from "@/lib/email-template";
import { sendGmailEmail } from "@/lib/gmail";

export type SendBookingCancellationEmailInput = {
  bookingReference: string;
  customerEmail: string;
  customerName: string;
  dogName: string;
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

  if (
    typeof input.startDate !== "string" ||
    !isValidDisplayDate(input.startDate)
  ) {
    throw new Error("The booking start date is invalid.");
  }

  if (typeof input.endDate !== "string" || !isValidDisplayDate(input.endDate)) {
    throw new Error("The booking end date is invalid.");
  }
}

export async function sendBookingCancellationEmail(
  input: SendBookingCancellationEmailInput,
): Promise<SendBookingCancellationEmailResult> {
  validateInput(input);

  const bookingReference = input.bookingReference.trim();

  const customerEmail = input.customerEmail.trim();

  const customerName = escapeHtml(input.customerName.trim());

  const dogName = escapeHtml(input.dogName.trim());

  const startDate = escapeHtml(input.startDate);

  const endDate = escapeHtml(input.endDate);

  const bodyContent = `
    <p>Hi ${customerName},</p>

    <p>
      We can confirm that your booking has been cancelled.
    </p>

    <p>
      <strong>Booking reference:</strong><br />
      ${escapeHtml(bookingReference)}
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
