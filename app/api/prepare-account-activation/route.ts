import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { sendAccountActivationEmail } from "@/lib/services/account-activation-email-service";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function optionalMetadataString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

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
            "A valid signup session is required to prepare account activation.",
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
          error: "The signup session is invalid or has expired.",
        },
        {
          status: 401,
        },
      );
    }

    if (!user.email) {
      return NextResponse.json(
        {
          error: "The signed-up account does not have an email address.",
        },
        {
          status: 400,
        },
      );
    }

    const metadata = user.user_metadata || {};

    const firstName = optionalMetadataString(metadata.first_name);

    const lastName = optionalMetadataString(metadata.last_name);

    const phone = optionalMetadataString(metadata.phone);

    const addressLine1 = optionalMetadataString(metadata.address1);

    const addressLine2 = optionalMetadataString(metadata.address2);

    const town = optionalMetadataString(metadata.town);

    const postcode = optionalMetadataString(metadata.postcode);

    if (!firstName) {
      return NextResponse.json(
        {
          error: "The signup profile does not contain a first name.",
        },
        {
          status: 400,
        },
      );
    }

    if (!lastName) {
      return NextResponse.json(
        {
          error: "The signup profile does not contain a last name.",
        },
        {
          status: 400,
        },
      );
    }

    if (!phone) {
      return NextResponse.json(
        {
          error: "The signup profile does not contain a contact number.",
        },
        {
          status: 400,
        },
      );
    }

    if (!addressLine1) {
      return NextResponse.json(
        {
          error: "The signup profile does not contain an address.",
        },
        {
          status: 400,
        },
      );
    }

    if (!town) {
      return NextResponse.json(
        {
          error: "The signup profile does not contain a town.",
        },
        {
          status: 400,
        },
      );
    }

    if (!postcode) {
      return NextResponse.json(
        {
          error: "The signup profile does not contain a postcode.",
        },
        {
          status: 400,
        },
      );
    }

    const email = user.email.trim().toLowerCase();

    const { data: existingProfile, error: existingProfileError } =
      await supabaseAdmin
        .from("profiles")
        .select(
          `
        id,
        active,
        was_activated,
        is_admin
        `,
        )
        .eq("id", user.id)
        .maybeSingle();

    if (existingProfileError) {
      return NextResponse.json(
        {
          error: existingProfileError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (existingProfile?.is_admin === true) {
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

    if (existingProfile?.active || existingProfile?.was_activated) {
      return NextResponse.json(
        {
          error: "This account has already been activated.",
        },
        {
          status: 409,
        },
      );
    }

    const activationToken = crypto.randomUUID();

    const activationExpiry = new Date();

    activationExpiry.setHours(activationExpiry.getHours() + 24);

    const updatedAt = new Date().toISOString();

    const { data: preparedProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          first_name: firstName,
          last_name: lastName,
          phone,
          email,
          address_line_1: addressLine1,
          address_line_2: addressLine2 || null,
          town,
          postcode,
          active: false,
          was_activated: false,
          is_admin: false,
          activation_token: activationToken,
          activation_token_expiry: activationExpiry.toISOString(),
          updated_at: updatedAt,
        },
        {
          onConflict: "id",
        },
      )
      .select(
        `
        id,
        first_name,
        email,
        active,
        was_activated
        `,
      )
      .single();

    if (profileError || !preparedProfile) {
      return NextResponse.json(
        {
          error:
            profileError?.message ||
            "The activation profile could not be prepared.",
        },
        {
          status: 500,
        },
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

    try {
      await sendAccountActivationEmail({
        customerEmail: preparedProfile.email,
        customerName: preparedProfile.first_name,
        activationToken,
        siteUrl,
        resent: false,
      });
    } catch (emailError) {
      console.error("Initial activation email failed:", emailError);

      return NextResponse.json(
        {
          success: true,
          profilePrepared: true,
          activationEmailSent: false,
          followUpRequired: true,
          profile: {
            id: preparedProfile.id,
            email: preparedProfile.email,
          },
          error:
            emailError instanceof Error
              ? emailError.message
              : "The activation email could not be sent.",
          message:
            "The account was created, but the activation email could not be sent.",
        },
        {
          status: 207,
        },
      );
    }

    return NextResponse.json({
      success: true,
      profilePrepared: true,
      activationEmailSent: true,
      followUpRequired: false,
      profile: {
        id: preparedProfile.id,
        email: preparedProfile.email,
      },
      message: "The account was created and the activation email was sent.",
    });
  } catch (error) {
    console.error("Account activation preparation failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to prepare account activation.",
      },
      {
        status: 500,
      },
    );
  }
}
