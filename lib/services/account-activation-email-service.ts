import { createEmailTemplate } from "@/lib/email-template";
import { sendGmailEmail } from "@/lib/gmail";

export type SendAccountActivationEmailInput = {
  customerEmail: string;
  customerName: string | null;
  activationToken: string;
  siteUrl: string;
  resent?: boolean;
};

export type SendAccountActivationEmailResult = {
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

function validateRequiredText(
  value: unknown,
  fieldName: string,
): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is missing.`);
  }
}

function normaliseSiteUrl(siteUrl: string) {
  return siteUrl.trim().replace(/\/+$/, "");
}

export async function sendAccountActivationEmail(
  input: SendAccountActivationEmailInput,
): Promise<SendAccountActivationEmailResult> {
  validateRequiredText(input.customerEmail, "Customer email");

  validateRequiredText(input.activationToken, "Activation token");

  validateRequiredText(input.siteUrl, "Site URL");

  if (input.customerName !== null && typeof input.customerName !== "string") {
    throw new Error("Customer name is invalid.");
  }

  if (input.resent !== undefined && typeof input.resent !== "boolean") {
    throw new Error("The activation resend status is invalid.");
  }

  const customerEmail = input.customerEmail.trim();

  const customerName = escapeHtml(input.customerName?.trim() || "there");

  const activationToken = input.activationToken.trim();

  const siteUrl = normaliseSiteUrl(input.siteUrl);

  let activationLink: string;

  try {
    const activationUrl = new URL("/activate", `${siteUrl}/`);

    activationUrl.searchParams.set("token", activationToken);

    activationLink = activationUrl.toString();
  } catch {
    throw new Error("The site URL is invalid.");
  }

  const safeActivationLink = escapeHtml(activationLink);

  const introductoryText = input.resent
    ? `
          <p>
            A new Browns Boarding account activation link
            has been requested for you.
          </p>
        `
    : `
          <p>
            Thank you for creating an account with
            Browns Boarding.
          </p>
        `;

  const bodyContent = `
    <p>Hi ${customerName},</p>

    ${introductoryText}

    <p>
      Please activate your account by clicking the button below.
    </p>

    <p style="margin: 28px 0;">
      ${safeActivationLink}
        Activate Account
      </a>
    </p>

    <p>
      This activation link will expire in 24 hours.
    </p>

    <p>
      If the button does not work, copy and paste this link
      into your browser:
    </p>

    <p style="word-break: break-all;">
      ${safeActivationLink}
        ${safeActivationLink}
      </a>
    </p>

    <p>
      If you did not request this account or activation link,
      please contact Browns Boarding.
    </p>

    <p>
      Thank you,<br />
      Browns Boarding
    </p>
  `;

  const emailBody = createEmailTemplate(
    "Activate Your Browns Boarding Account",
    bodyContent,
  );

  await sendGmailEmail({
    to: customerEmail,
    subject: input.resent
      ? "Your new Browns Boarding activation link"
      : "Activate your Browns Boarding account",
    html: emailBody,
  });

  return {
    success: true,
    sent: true,
    recipient: customerEmail,
    message: input.resent
      ? "A new activation email has been sent."
      : "The account activation email has been sent.",
  };
}
