import { createEmailTemplate } from "@/lib/email-template";
import { sendGmailEmail } from "@/lib/gmail";

export type SendBookingConfirmationEmailInput = {
  bookingReference: string;
  customerEmail: string;
  customerName: string;
  dogName: string;
  startDate: string;
  endDate: string;
  totalCost: string;
  depositAmount: string;
  balanceAmount: string;
  shortNoticeBooking: boolean;
};

export type SendBookingConfirmationEmailResult = {
  success: true;
  sent: true;
  recipient: string;
  message: string;
};

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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function validateInput(input: SendBookingConfirmationEmailInput) {
  if (
    typeof input.bookingReference !== "string" ||
    !input.bookingReference.trim()
  ) {
    throw new Error("Booking reference is missing.");
  }

  if (typeof input.customerEmail !== "string" || !input.customerEmail.trim()) {
    throw new Error("Customer email is missing.");
  }

  if (typeof input.customerName !== "string" || !input.customerName.trim()) {
    throw new Error("Customer name is missing.");
  }

  if (typeof input.dogName !== "string" || !input.dogName.trim()) {
    throw new Error("Dog name is missing.");
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

  if (typeof input.totalCost !== "string" || !input.totalCost.trim()) {
    throw new Error("The total cost is missing.");
  }

  if (typeof input.depositAmount !== "string" || !input.depositAmount.trim()) {
    throw new Error("The deposit amount is missing.");
  }

  if (typeof input.balanceAmount !== "string" || !input.balanceAmount.trim()) {
    throw new Error("The balance amount is missing.");
  }

  if (typeof input.shortNoticeBooking !== "boolean") {
    throw new Error("The short-notice booking status is invalid.");
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

export async function sendBookingConfirmationEmail(
  input: SendBookingConfirmationEmailInput,
): Promise<SendBookingConfirmationEmailResult> {
  validateInput(input);

  const bookingReference = input.bookingReference.trim();

  const customerEmail = input.customerEmail.trim();

  const customerName = escapeHtml(input.customerName.trim());

  const dogName = escapeHtml(input.dogName.trim());

  const startDate = escapeHtml(input.startDate);

  const endDate = escapeHtml(input.endDate);

  const totalCost = escapeHtml(input.totalCost.trim());

  const depositAmount = escapeHtml(input.depositAmount.trim());

  const balanceAmount = escapeHtml(input.balanceAmount.trim());

  const balanceDueDate = escapeHtml(getBalanceDueDate(input.startDate));

  const paymentText = input.shortNoticeBooking
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
            <strong>Remaining balance due by ${balanceDueDate}:</strong><br />
            ${balanceAmount}
          </p>
        `;

  const bodyContent = `
    <p>Hi ${customerName},</p>

    <p>
      Your booking for ${dogName} has been confirmed.
    </p>

    <p>
      <strong>Booking reference:</strong><br />
      ${escapeHtml(bookingReference)}
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

  const emailBody = createEmailTemplate("Booking Confirmed", bodyContent);

  await sendGmailEmail({
    to: customerEmail,
    subject: `Booking confirmed - ${bookingReference}`,
    html: emailBody,
  });

  return {
    success: true,
    sent: true,
    recipient: customerEmail,
    message: "The booking confirmation email was sent successfully.",
  };
}
