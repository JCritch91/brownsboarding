import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { sendAccountActivationEmail } from "@/lib/services/account-activation-email-service";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type ResendActivationRequest = {
  token?: unknown;
};

export async function POST(request: Request) {
  try {
    let body: ResendActivationRequest;

    try {
      body = (await request.json()) as ResendActivationRequest;
    } catch {
      return NextResponse.json(
        {
          error: "The activation request is invalid.",
        },
        {
          status: 400,
        },
      );
    }

    const token = typeof body.token === "string" ? body.token.trim() : "";

    if (!token) {
      return NextResponse.json(
        {
          error: "Activation token is missing.",
        },
        {
          status: 400,
        },
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        first_name,
        email,
        active,
        was_activated,
        is_admin,
        activation_token
        `,
      )
      .eq("activation_token", token)
      .maybeSingle();

    if (profileError) {
      console.error("Activation profile lookup failed:", profileError);

      return NextResponse.json(
        {
          error: "Unable to find an account for this activation link.",
        },
        {
          status: 404,
        },
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          error: "Unable to find an account for this activation link.",
        },
        {
          status: 404,
        },
      );
    }

    if (profile.is_admin === true) {
      return NextResponse.json(
        {
          error:
            "Administrator accounts cannot use the public customer activation workflow.",
        },
        {
          status: 409,
        },
      );
    }

    if (profile.active || profile.was_activated) {
      return NextResponse.json(
        {
          error: "This account has already been activated.",
        },
        {
          status: 409,
        },
      );
    }

    if (!profile.email) {
      return NextResponse.json(
        {
          error: "This account does not have an email address.",
        },
        {
          status: 409,
        },
      );
    }

    const newActivationToken = crypto.randomUUID();

    const newActivationExpiry = new Date();

    newActivationExpiry.setHours(newActivationExpiry.getHours() + 24);

    const updatedAt = new Date().toISOString();

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        activation_token: newActivationToken,
        activation_token_expiry: newActivationExpiry.toISOString(),
        updated_at: updatedAt,
      })
      .eq("id", profile.id)
      .eq("activation_token", token)
      .eq("active", false)
      .eq("was_activated", false)
      .select(
        `
        id,
        first_name,
        email,
        activation_token_expiry
        `,
      )
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        {
          error: updateError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!updatedProfile) {
      return NextResponse.json(
        {
          error:
            "The activation link changed before the request completed. Please use the most recently issued activation email.",
        },
        {
          status: 409,
        },
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

    try {
      await sendAccountActivationEmail({
        customerEmail: updatedProfile.email,
        customerName: updatedProfile.first_name,
        activationToken: newActivationToken,
        siteUrl,
        resent: true,
      });
    } catch (emailError) {
      console.error("Activation email resend failed:", emailError);

      return NextResponse.json(
        {
          success: true,
          activationPrepared: true,
          activationEmailSent: false,
          followUpRequired: true,
          error:
            emailError instanceof Error
              ? emailError.message
              : "The activation email could not be sent.",
          message:
            "A new activation link was prepared, but the email could not be sent. Please try again.",
        },
        {
          status: 207,
        },
      );
    }

    return NextResponse.json({
      success: true,
      activationPrepared: true,
      activationEmailSent: true,
      followUpRequired: false,
      message: "A new activation email has been sent. Please check your inbox.",
    });
  } catch (error) {
    console.error("Activation email resend failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to resend the activation email.",
      },
      {
        status: 500,
      },
    );
  }
}
