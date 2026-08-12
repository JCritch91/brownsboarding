import { NextResponse } from "next/server";
import { sendGmailEmail } from "@/lib/gmail";
import { createEmailTemplate } from "@/lib/email-template";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      customerEmail,
      customerName,
      activationToken,
    } = body;

    if (!customerEmail || !activationToken) {
      return NextResponse.json(
        { error: "Missing email address or activation token." },
        { status: 400 }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

    const activationLink = `${siteUrl}/activate?token=${activationToken}`;

    const bodyContent = `
      <p>Hi ${customerName || "there"},</p>

      <p>
        Thank you for creating an account with Browns Boarding.
      </p>

      <p>
        Before you can access your account, please activate it by clicking the button below.
      </p>

      <p style="margin: 28px 0;">
        <a
          href="${activationLink}"
          style="
            background: #8B6A4E;
            color: #FFFFFF;
         paste this link into your browser:
      </p>

      <p>
        ${activationLink}
      </p>

      <p>
        Thank you,<br />
        Browns Boarding
      </p>
    `;

    const emailBody = createEmailTemplate(
      "Activate Your Browns Boarding Account",
      bodyContent
    );

    await sendGmailEmail({
      to: customerEmail,
      subject: "Activate your Browns Boarding account",
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
            : "Unable to send activation email.",
      },
      { status: 500 }
    );
  }
}