import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { sendGmailEmail } from "@/lib/gmail";
import { createEmailTemplate } from "@/lib/email-template";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type CreateCustomerRequest = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_line_1: string;
  address_line_2: string;
  town: string;
  postcode: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  vet_name: string;
  vet_phone: string;
  vet_address: string;
};

export async function POST(request: Request) {
  let createdUserId: string | null = null;

  try {
    const authorizationHeader = request.headers.get("authorization");

    const accessToken = authorizationHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "You must be signed in as an admin.",
        },
        {
          status: 401,
        },
      );
    }

    const {
      data: { user: signedInUser },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !signedInUser) {
      return NextResponse.json(
        {
          error: "Unable to verify the signed-in user.",
        },
        {
          status: 401,
        },
      );
    }

    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id, is_admin, active")
      .eq("id", signedInUser.id)
      .maybeSingle();

    if (adminProfileError) {
      return NextResponse.json(
        {
          error: adminProfileError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!adminProfile || !adminProfile.is_admin || !adminProfile.active) {
      return NextResponse.json(
        {
          error: "You do not have permission to create customers.",
        },
        {
          status: 403,
        },
      );
    }

    const body = (await request.json()) as CreateCustomerRequest;

    const firstName = body.first_name?.trim();
    const lastName = body.last_name?.trim();
    const email = body.email?.trim().toLowerCase();

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        {
          error: "First name, last name and email address are required.",
        },
        {
          status: 400,
        },
      );
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      return NextResponse.json(
        {
          error: "Please enter a valid email address.",
        },
        {
          status: 400,
        },
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

    const redirectTo = `${siteUrl}/set-password`;

    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
          redirectTo,
        },
      });

    if (inviteError || !inviteData.user) {
      return NextResponse.json(
        {
          error:
            inviteError?.message || "Unable to create the customer account.",
        },
        {
          status: 400,
        },
      );
    }

    createdUserId = inviteData.user.id;

    const inviteLink = inviteData.properties?.action_link;

    if (!inviteLink) {
      throw new Error("Supabase did not return a customer invitation link.");
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: createdUserId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: body.phone?.trim() || null,
        address_line_1: body.address_line_1?.trim() || null,
        address_line_2: body.address_line_2?.trim() || null,
        town: body.town?.trim() || null,
        postcode: body.postcode?.trim() || null,
        emergency_contact_name: body.emergency_contact_name?.trim() || null,
        emergency_contact_phone: body.emergency_contact_phone?.trim() || null,
        vet_name: body.vet_name?.trim() || null,
        vet_phone: body.vet_phone?.trim() || null,
        vet_address: body.vet_address?.trim() || null,
        meet_and_greet_approved: false,
        is_admin: false,
        active: false,
        was_activated: false,
        activated_at: null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "id",
      },
    );

    if (profileError) {
      throw new Error(profileError.message);
    }

    const bodyContent = `
      <p>Hi ${firstName},</p>

      <p>
        Browns Boarding has created an account for you.
      </p>

      <p>
        Please use the button below to accept your invitation
        and set your account password.
      </p>

      <p style="margin: 28px 0;">
        ${inviteLink}
          Set Up Your Account
        </a>
      </p>

      <p>
        If the button does not work, copy and paste this link
        into your browser:
      </p>

      <p style="word-break: break-all;">
        ${inviteLink}
      </p>

      <p>
        Thank you,<br />
        Browns Boarding
      </p>
    `;

    const emailBody = createEmailTemplate(
      "Set Up Your Browns Boarding Account",
      bodyContent,
    );

    await sendGmailEmail({
      to: email,
      subject: "Set up your Browns Boarding account",
      html: emailBody,
    });

    return NextResponse.json({
      success: true,
      customerId: createdUserId,
      message: "Customer created and invitation email sent successfully.",
    });
  } catch (error) {
    console.error("Admin customer creation failed:", error);

    /*
     * Roll back the Auth user if profile creation or email
     * delivery failed. This prevents an unusable half-created
     * account from remaining in Supabase.
     */
    if (createdUserId) {
      await supabaseAdmin.from("profiles").delete().eq("id", createdUserId);

      await supabaseAdmin.auth.admin.deleteUser(createdUserId);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create the customer.",
      },
      {
        status: 500,
      },
    );
  }
}
