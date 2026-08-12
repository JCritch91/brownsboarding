import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
      .select("id, active, was_activated, activation_token_expiry")
      .eq("activation_token", token)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "This activation link is invalid." },
        { status: 400 }
      );
    }

    if (profile.active && profile.was_activated) {
      return NextResponse.json({
        success: true,
        message: "This account has already been activated.",
      });
    }

    const now = new Date();

    if (
      profile.activation_token_expiry &&
      new Date(profile.activation_token_expiry) < now
    ) {
      return NextResponse.json(
        { error: "This activation link has expired." },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        active: true,
        was_activated: true,
        activated_at: new Date().toISOString(),
        activation_token: null,
        activation_token_expiry: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Account activated successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to activate account.",
      },
      { status: 500 }
    );
  }
}