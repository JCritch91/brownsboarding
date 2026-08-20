import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { sendGmailEmail } from "@/lib/gmail";
import {
  createEmailTemplate,
} from "@/lib/email-template";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RouteContext = {
  params: Promise<{
    customerId: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const { customerId } =
      await context.params;

    if (!customerId?.trim()) {
      return NextResponse.json(
        {
          error: "Customer ID is missing.",
        },
        {
          status: 400,
        }
      );
    }

    const authorizationHeader =
      request.headers.get("authorization");

    const accessToken =
      authorizationHeader?.replace(
        "Bearer ",
        ""
      );

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "You must be signed in as an administrator.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(
      accessToken
    );

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "Unable to verify the signed-in user.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: adminProfile,
      error: adminProfileError,
    } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        active,
        is_admin
        `
      )
      .eq("id", user.id)
      .maybeSingle();

    if (adminProfileError) {
      return NextResponse.json(
        {
          error:
            adminProfileError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      !adminProfile ||
      !adminProfile.active ||
      !adminProfile.is_admin
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to resend customer activation emails.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      data: customer,
      error: customerLoadError,
    } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        first_name,
        last_name,
        email,
        was_activated,
        is_admin
        `
      )
      .eq("id", customerId)
      .maybeSingle();

    if (customerLoadError) {
      return NextResponse.json(
        {
          error:
            customerLoadError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!customer) {
      return NextResponse.json(
        {
          error:
            "The customer could not be found.",
        },
        {
          status: 404,
        }
      );
    }

    if (customer.is_admin === true) {
      return NextResponse.json(
        {
          error:
            "Administrator accounts cannot be managed through the customer activation workflow.",
        },
        {
          status: 409,
        }
      );
    }

    if (customer.was_activated) {
      return NextResponse.json(
        {
          error:
            "This customer has already activated their account.",
        },
        {
          status: 409,
        }
      );
    }

    if (!customer.email) {
      return NextResponse.json(
        {
          error:
            "This customer does not have an email address.",
        },
        {
          status: 409,
        }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      new URL(request.url).origin;

    const redirectTo =
      `${siteUrl}/set-password`;

    const {
      data: inviteData,
      error: inviteError,
    } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email: customer.email,
        options: {
          data: {
            first_name:
              customer.first_name || "",
            last_name:
              customer.last_name || "",
          },
          redirectTo,
        },
      });

    if (inviteError) {
      return NextResponse.json(
        {
          error:
            inviteError.message ||
            "A new invitation link could not be generated.",
        },
        {
          status: 500,
        }
      );
    }

    const inviteLink =
      inviteData.properties?.action_link;

    if (!inviteLink) {
      return NextResponse.json(
        {
          error:
            "Supabase did not return a new invitation link.",
        },
        {
          status: 500,
        }
      );
    }

    const customerName =
      `${customer.first_name || ""} ${
        customer.last_name || ""
      }`.trim() || "Customer";

    const bodyContent = `
      <p>Hi ${customerName},</p>

      <p>
        A new Browns Boarding account invitation
        has been requested for you.
      </p>

      <p>
        Use the button below to set your account
        password and complete your account setup.
      </p>

      <p style="margin: 28px 0;">
        ${inviteLink}
          Set Up Your Account
        </a>
      </p>

      <p>
        If the button does not work, copy and paste
        this link into your browser:
      </p>

      <p style="word-break: break-all;">
        ${inviteLink}
      </p>

      <p>
        If you were not expecting this invitation,
        please contact Browns Boarding.
      </p>

      <p>
        Thank you,<br />
        Browns Boarding
      </p>
    `;

    const emailBody =
      createEmailTemplate(
        "Set Up Your Browns Boarding Account",
        bodyContent
      );

    await sendGmailEmail({
      to: customer.email,
      subject:
        "Set up your Browns Boarding account",
      html: emailBody,
    });

    return NextResponse.json({
      success: true,
      activationEmailSent: true,
      customer: {
        id: customer.id,
        email: customer.email,
      },
      message:
        "A new activation email has been sent successfully.",
    });
  } catch (error) {
    console.error(
      "Admin activation email resend failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to resend the activation email.",
      },
      {
        status: 500,
      }
    );
  }
}