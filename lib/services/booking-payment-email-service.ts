import { createEmailTemplate } from "@/lib/email-template";
import { sendGmailEmail } from "@/lib/gmail";

type BookingPaymentEmailBaseInput = {
  bookingReference: string;
  customerEmail: string;
  customerName: string;
  dogName: string;
  startDate: string;
  endDate: string;
  invoiceNumber: string;
};

export type SendDepositReceivedEmailInput = BookingPaymentEmailBaseInput & {
  depositPaidDate: string;
  depositAmount: string;
};

export type SendBalanceReceivedEmailInput = BookingPaymentEmailBaseInput & {
  balancePaidDate: string;
  balanceAmount: string;
};

export type BookingPaymentEmailResult = {
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

function validateBaseInput(input: BookingPaymentEmailBaseInput) {
  validateRequiredText(input.bookingReference, "Booking reference");

  validateRequiredText(input.customerEmail, "Customer email");

  validateRequiredText(input.customerName, "Customer name");

  validateRequiredText(input.dogName, "Dog name");

  validateRequiredText(input.invoiceNumber, "Invoice number");

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

function getBalanceDueDate(startDate: string) {
  const [dayText, monthText, yearText] = startDate.split("/");

  const dueDate = new Date(
    Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)),
  );

  dueDate.setUTCDate(dueDate.getUTCDate() - 14);

  const dueDay = String(dueDate.getUTCDate()).padStart(2, "0");

  const dueMonth = String(dueDate.getUTCMonth() + 1).padStart(2, "0");

  const dueYear = dueDate.getUTCFullYear();

  return `${dueDay}/${dueMonth}/${dueYear}`;
}

export async function sendDepositReceivedEmail(
  input: SendDepositReceivedEmailInput,
): Promise<BookingPaymentEmailResult> {
  validateBaseInput(input);

  if (
    typeof input.depositPaidDate !== "string" ||
    !isValidDisplayDate(input.depositPaidDate)
  ) {
    throw new Error("The deposit paid date is invalid.");
  }

  validateRequiredText(input.depositAmount, "Deposit amount");

  const bookingReference = input.bookingReference.trim();

  const customerEmail = input.customerEmail.trim();

  const customerName = escapeHtml(input.customerName.trim());

  const dogName = escapeHtml(input.dogName.trim());

  const startDate = escapeHtml(input.startDate);

  const endDate = escapeHtml(input.endDate);

  const invoiceNumber = escapeHtml(input.invoiceNumber.trim());

  const depositPaidDate = escapeHtml(input.depositPaidDate);

  const depositAmount = escapeHtml(input.depositAmount.trim());

  const balanceDueDate = escapeHtml(getBalanceDueDate(input.startDate));

  const bodyContent = `
    <p>Hi ${customerName},</p>

    <p>
      Thank you. We can confirm that we have received the deposit for
      ${dogName}'s booking.
    </p>

    <p>
      <strong>Booking reference:</strong><br />
      ${escapeHtml(bookingReference)}
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
      <strong>${balanceDueDate}</strong>.
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

  const emailBody = createEmailTemplate("Deposit Received", bodyContent);

  await sendGmailEmail({
    to: customerEmail,
    subject: `Deposit received - ${bookingReference}`,
    html: emailBody,
  });

  return {
    success: true,
    sent: true,
    recipient: customerEmail,
    message: "The deposit received email was sent successfully.",
  };
}

export async function sendBalanceReceivedEmail(
  input: SendBalanceReceivedEmailInput,
): Promise<BookingPaymentEmailResult> {
  validateBaseInput(input);

  if (
    typeof input.balancePaidDate !== "string" ||
    !isValidDisplayDate(input.balancePaidDate)
  ) {
    throw new Error("The balance paid date is invalid.");
  }

  validateRequiredText(input.balanceAmount, "Balance amount");

  const bookingReference = input.bookingReference.trim();

  const customerEmail = input.customerEmail.trim();

  const customerName = escapeHtml(input.customerName.trim());

  const dogName = escapeHtml(input.dogName.trim());

  const startDate = escapeHtml(input.startDate);

  const endDate = escapeHtml(input.endDate);

  const invoiceNumber = escapeHtml(input.invoiceNumber.trim());

  const balancePaidDate = escapeHtml(input.balancePaidDate);

  const balanceAmount = escapeHtml(input.balanceAmount.trim());

  const bodyContent = `
    <p>Hi ${customerName},</p>

    <p>
      Thank you. We can confirm that we have received the remaining balance
      for ${dogName}'s booking.
    </p>

    <p>
      <strong>Booking reference:</strong><br />
      ${escapeHtml(bookingReference)}
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

  const emailBody = createEmailTemplate("Full Balance Received", bodyContent);

  await sendGmailEmail({
    to: customerEmail,
    subject: `Full balance received - ${bookingReference}`,
    html: emailBody,
  });

  return {
    success: true,
    sent: true,
    recipient: customerEmail,
    message: "The balance received email was sent successfully.",
  };
}
