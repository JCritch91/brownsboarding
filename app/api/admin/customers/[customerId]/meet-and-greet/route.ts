import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type RouteContext = {
  params: Promise<{
    customerId: string;
  }>;
};

type UpdateMeetAndGreetRequest = {
  approved?: unknown;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { customerId } = await context.params;

    if (!customerId?.trim()) {
      return NextResponse.json(
        {
          error: "Customer ID is missing.",
        },
        {
          status: 400,
        },
      );
    }

    const authorizationHeader = request.headers.get("authorization");

    const accessToken = authorizationHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "You must be signed in as an administrator.",
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

    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        active,
        is_admin
        `,
      )
      .eq("id", user.id)
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

    if (!adminProfile || !adminProfile.active || !adminProfile.is_admin) {
      return NextResponse.json(
        {
          error: "You do not have permission to manage Meet & Greet approval.",
        },
        {
          status: 403,
        },
      );
    }

    const body = (await request.json()) as UpdateMeetAndGreetRequest;

    if (typeof body.approved !== "boolean") {
      return NextResponse.json(
        {
          error: "The requested Meet & Greet approval status is invalid.",
        },
        {
          status: 400,
        },
      );
    }

    const requestedApprovalStatus = body.approved;

    const { data: customer, error: customerLoadError } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        first_name,
        last_name,
        email,
        meet_and_greet_approved
        `,
      )
      .eq("id", customerId)
      .maybeSingle();

    if (customerLoadError) {
      return NextResponse.json(
        {
          error: customerLoadError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!customer) {
      return NextResponse.json(
        {
          error: "The customer could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    const existingApprovalStatus = customer.meet_and_greet_approved === true;

    if (existingApprovalStatus === requestedApprovalStatus) {
      return NextResponse.json({
        success: true,
        meetAndGreetApprovalUpdated: true,
        customer: {
          id: customer.id,
          meetAndGreetApproved: existingApprovalStatus,
        },
        message: requestedApprovalStatus
          ? "Meet & Greet approval is already in place."
          : "Meet & Greet approval has already been removed.",
      });
    }

    const { data: updatedCustomer, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        meet_and_greet_approved: requestedApprovalStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customer.id)
      .select(
        `
        id,
        meet_and_greet_approved
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

    if (!updatedCustomer) {
      return NextResponse.json(
        {
          error:
            "The Meet & Greet approval could not be updated because the customer record changed before the request completed.",
        },
        {
          status: 409,
        },
      );
    }

    const meetAndGreetApproved =
      updatedCustomer.meet_and_greet_approved === true;

    return NextResponse.json({
      success: true,
      meetAndGreetApprovalUpdated: true,
      customer: {
        id: updatedCustomer.id,
        meetAndGreetApproved,
      },
      message: meetAndGreetApproved
        ? "Meet & Greet approval added successfully."
        : "Meet & Greet approval removed successfully.",
    });
  } catch (error) {
    console.error("Admin Meet & Greet approval update failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update Meet & Greet approval.",
      },
      {
        status: 500,
      },
    );
  }
}
