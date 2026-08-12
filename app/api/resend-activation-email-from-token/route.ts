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

    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Activation token is missing." },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, email, active, was_activated")
      .eq("activation_token", token)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Unable to find an account for this activation link." },
        { status: 404 }
      );
    }

    if (profile.active || profile.was_activated) {
      return NextResponse.json(
        { error: "This account has already been activated." },
        { status: 400 }
      );
    }

    if (!profile.email) {
      return NextResponse.json(
        { error: "This account does not have an email address." },
        { status: 400 }
      );
    }

    const newActivationToken = crypto.randomUUID();

    const newActivationExpiry = new Date();
    newActivationExpiry.setHours(newActivationExpiry.getHours() + 24);

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        activation_token: newActivationToken,
        activation_token_expiry: newActivationExpiry.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

    const activationLink = `${siteUrl}/activate?token=${newActivationToken}`;

    const bodyContent = `
      <p>Hi ${profile.first_name || "there"},</p>

      <p>
        You requested a new Browns Boarding account activation link.
      </p>

      <p>
        Please activate your account by clicking the button below.
      </p>

      <p style="margin: 28px 0;">
        <a
          href="${activationLink}"
          style="
            background: #8B6A4E;
            color: #FFFFFF;
            padding: 12px 20px;
            border-radius: 8px;
    t work, copy and paste this link into your browser:
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
      to: profile.email,
      subject: "Activate your Browns Boarding account",
      html: emailBody,
    });

    return NextResponse.json({
      success: true,
      message: "A new activation email has been sent.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to resend activation email.",
      },
      { status: 500 }
    );
  }
}