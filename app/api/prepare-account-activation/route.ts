import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendGmailEmail } from "@/lib/gmail";
import { createEmailTemplate } from "@/lib/email-template";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      userId,
      firstName,
      lastName,
      phone,
      email,
      address1,
      address2,
      town,
      postcode,
    } = body;

    if (!userId || !email) {
      return NextResponse.json(
        { error: "Missing user ID or email address." },
        { status: 400 }
      );
    }

    const activationToken = crypto.randomUUID();

    const activationExpiry = new Date();
    activationExpiry.setHours(activationExpiry.getHours() + 24);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          first_name: firstName,
          last_name: lastName,
          phone,
          email,
          address_line_1: address1,
          address_line_2: address2,
          town,
          postcode,
          active: false,
          was_activated: false,
          activation_token: activationToken,
          activation_token_expiry: activationExpiry.toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id",
        }
      );

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

    const activationLink = `${siteUrl}/activate?token=${activationToken}`;

    const bodyContent = `
      <p>Hi ${firstName || "there"},</p>

      <p>
        Thank you for creating an account with Browns Boarding.
      </p>

      <p>
        Before you can access your account, please activate it by clicking the button below.
      </p>

      <p style="margin: 28px 0;">
        ${activationLink}
          Activate Account
        </a>
      </p>

      <p>
        This activation link will expire in 24 hours.
      </p>

      <p>
        If the button does not work, copy and paste this link into your browser:
      </p>

      <p>
        ${activationLink}
          ${activationLink}
        </a>
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
      to: email,
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
            : "Unable to prepare account activation.",
      },
      { status: 500 }
    );
  }
}