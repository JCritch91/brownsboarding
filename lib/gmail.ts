import nodemailer from "nodemailer";

const gmailUser = process.env.GMAIL_USER;
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

if (!gmailUser || !gmailAppPassword) {
  throw new Error("Gmail email settings are missing.");
}

export const gmailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailUser,
    pass: gmailAppPassword,
  },
});

type SendGmailOptions = {
  to: string;
  subject: string;
  html: string;
};

export async function sendGmailEmail({
  to,
  subject,
  html,
}: SendGmailOptions) {
  if (!to) {
    throw new Error("Email recipient is missing.");
  }

  await gmailTransporter.sendMail({
    from: `"Browns Boarding" <${gmailUser}>`,
    to,
    subject,
    html,
  });
}
