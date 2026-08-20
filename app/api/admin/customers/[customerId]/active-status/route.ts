import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { ACTIVE_BOOKING_STATUSES } from "@/types/booking";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type RouteContext = {
  params: Promise<{
    customerId: string;
  }>;
};

type UpdateActiveStatusRequest = {
  active?: unknown;
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
          error:
            "You do not have permission to manage customer account status.",
        },
        {
          status: 403,
        },
      );
    }

    const body = (await request.json()) as UpdateActiveStatusRequest;

    if (typeof body.active !== "boolean") {
      return NextResponse.json(
        {
          error: "The requested account status is invalid.",
        },
        {
          status: 400,
        },
      );
    }

    const requestedActiveStatus = body.active;

    const { data: customer, error: customerLoadError } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        first_name,
        last_name,
        email,
        active,
        is_admin
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

    if (customer.id === user.id && !requestedActiveStatus) {
      return NextResponse.json(
        {
          error: "You cannot deactivate your own administrator account.",
        },
        {
          status: 409,
        },
      );
    }

    if (customer.active === requestedActiveStatus) {
      return NextResponse.json({
        success: true,
        customerStatusUpdated: true,
        customer: {
          id: customer.id,
          active: customer.active,
        },
        message: requestedActiveStatus
          ? "The customer account is already active."
          : "The customer account is already inactive.",
      });
    }

    /*
     * Deactivation is blocked while the customer has
     * a booking in any active lifecycle stage.
     */
    if (!requestedActiveStatus) {
      const { count: activeBookingCount, error: bookingCheckError } =
        await supabaseAdmin
          .from("bookings")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("owner_id", customer.id)
          .in("status", ACTIVE_BOOKING_STATUSES);

      if (bookingCheckError) {
        return NextResponse.json(
          {
            error: bookingCheckError.message,
          },
          {
            status: 500,
          },
        );
      }

      if (activeBookingCount !== null && activeBookingCount > 0) {
        return NextResponse.json(
          {
            error:
              "This customer cannot be deactivated while they have an active booking. Cancel or complete all active bookings first.",
          },
          {
            status: 409,
          },
        );
      }
    }

    const { data: updatedCustomer, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        active: requestedActiveStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customer.id)
      .eq("active", customer.active)
      .select(
        `
        id,
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

    if (!updatedCustomer) {
      return NextResponse.json(
        {
          error:
            "The customer account status changed before the request completed. Refresh the page and try again.",
        },
        {
          status: 409,
        },
      );
    }

    return NextResponse.json({
      success: true,
      customerStatusUpdated: true,
      customer: {
        id: updatedCustomer.id,
        active: updatedCustomer.active,
      },
      message: updatedCustomer.active
        ? "Customer account activated successfully."
        : "Customer account deactivated successfully.",
    });
  } catch (error) {
    console.error("Admin customer active-status update failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update the customer account status.",
      },
      {
        status: 500,
      },
    );
  }
}
