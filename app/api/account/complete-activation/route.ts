import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  try {
    const authorizationHeader = request.headers.get("authorization");

    const accessToken = authorizationHeader?.startsWith("Bearer ")
      ? authorizationHeader.slice(7).trim()
      : "";

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "A valid invitation session is required to activate the account.",
        },
        {
          status: 401,
        },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "The invitation session is invalid or has expired.",
        },
        {
          status: 401,
        },
      );
    }

    const { data: profile, error: profileLoadError } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        email,
        active,
        was_activated,
        is_admin
        `,
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileLoadError) {
      return NextResponse.json(
        {
          error: profileLoadError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          error: "The customer profile could not be found.",
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
            "Administrator accounts cannot be activated through the customer invitation workflow.",
        },
        {
          status: 409,
        },
      );
    }

    if (
      profile.email &&
      user.email &&
      profile.email.toLowerCase() !== user.email.toLowerCase()
    ) {
      return NextResponse.json(
        {
          error: "The invitation session does not match the customer profile.",
        },
        {
          status: 403,
        },
      );
    }

    if (profile.active && profile.was_activated) {
      return NextResponse.json({
        success: true,
        profileActivated: true,
        alreadyActivated: true,
        profile: {
          id: profile.id,
          active: profile.active,
          wasActivated: profile.was_activated,
        },
        message: "This account has already been activated.",
      });
    }

    const activatedAt = new Date().toISOString();

    const { data: activatedProfile, error: activationError } =
      await supabaseAdmin
        .from("profiles")
        .update({
          active: true,
          was_activated: true,
          activated_at: activatedAt,
          activation_token: null,
          activation_token_expiry: null,
          updated_at: activatedAt,
        })
        .eq("id", user.id)
        .or("is_admin.eq.false,is_admin.is.null")
        .select(
          `
        id,
        active,
        was_activated,
        activated_at
        `,
        )
        .maybeSingle();

    if (activationError) {
      return NextResponse.json(
        {
          error: activationError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!activatedProfile) {
      return NextResponse.json(
        {
          error:
            "The customer profile could not be activated because its status changed before the request completed.",
        },
        {
          status: 409,
        },
      );
    }

    return NextResponse.json({
      success: true,
      profileActivated: true,
      alreadyActivated: false,
      profile: {
        id: activatedProfile.id,
        active: activatedProfile.active,
        wasActivated: activatedProfile.was_activated,
        activatedAt: activatedProfile.activated_at,
      },
      message: "Your account has been activated successfully.",
    });
  } catch (error) {
    console.error("Customer profile activation failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to activate the customer account.",
      },
      {
        status: 500,
      },
    );
  }
}
