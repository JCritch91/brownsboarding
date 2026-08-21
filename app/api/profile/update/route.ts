import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  formatAddressLine,
  formatEmail,
  formatName,
  formatPostcode,
  formatUkPhone,
} from "@/lib/helpers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type UpdateProfileRequest = {
  first_name?: unknown;
  last_name?: unknown;
  email?: unknown;
  phone?: unknown;
  address_line_1?: unknown;
  address_line_2?: unknown;
  town?: unknown;
  postcode?: unknown;
  emergency_contact_name?: unknown;
  emergency_contact_phone?: unknown;
};

function optionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(request: Request) {
  try {
    const authorizationHeader = request.headers.get("authorization");

    const accessToken = authorizationHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "You must be signed in to update your details.",
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
          error: "Unable to verify the signed-in user.",
        },
        {
          status: 401,
        },
      );
    }

    const { data: existingProfile, error: profileLoadError } =
      await supabaseAdmin
        .from("profiles")
        .select(
          `
        id,
        email,
        active
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

    if (!existingProfile) {
      return NextResponse.json(
        {
          error: "Your customer profile could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    if (!existingProfile.active) {
      return NextResponse.json(
        {
          error: "An inactive account cannot update its profile.",
        },
        {
          status: 403,
        },
      );
    }

    const body = (await request.json()) as UpdateProfileRequest;

    const firstName = formatName(optionalString(body.first_name));

    const lastName = formatName(optionalString(body.last_name));

    const submittedEmail = formatEmail(optionalString(body.email));

    if (!firstName || !lastName) {
      return NextResponse.json(
        {
          error: "First name and last name are required.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * The customer cannot change the account email
     * through this profile route. Email changes require
     * an authenticated Supabase Auth workflow.
     */
    if (
      submittedEmail &&
      existingProfile.email &&
      submittedEmail !== formatEmail(existingProfile.email)
    ) {
      return NextResponse.json(
        {
          error: "Your email address cannot be changed from this page.",
        },
        {
          status: 400,
        },
      );
    }

    const phone = formatUkPhone(optionalString(body.phone));

    const addressLine1 = formatAddressLine(optionalString(body.address_line_1));

    const addressLine2 = formatAddressLine(optionalString(body.address_line_2));

    const town = formatName(optionalString(body.town));

    const postcode = formatPostcode(optionalString(body.postcode));

    const emergencyContactName = formatName(
      optionalString(body.emergency_contact_name),
    );

    const emergencyContactPhone = formatUkPhone(
      optionalString(body.emergency_contact_phone),
    );

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        address_line_1: addressLine1 || null,
        address_line_2: addressLine2 || null,
        town: town || null,
        postcode: postcode || null,
        emergency_contact_name: emergencyContactName || null,
        emergency_contact_phone: emergencyContactPhone || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .eq("active", true)
      .select(
        `
        id,
        first_name,
        last_name,
        email,
        phone,
        address_line_1,
        address_line_2,
        town,
        postcode,
        emergency_contact_name,
        emergency_contact_phone
        active
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
            "Your profile could not be updated because its status changed before the request completed.",
        },
        {
          status: 409,
        },
      );
    }

    return NextResponse.json({
      success: true,
      profileUpdated: true,
      profile: updatedProfile,
      message: "Your details have been updated successfully.",
    });
  } catch (error) {
    console.error("Customer profile update failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update your details.",
      },
      {
        status: 500,
      },
    );
  }
}
