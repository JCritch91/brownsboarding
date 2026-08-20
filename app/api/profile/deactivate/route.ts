import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type DeactivationResult = {
  customer_id: string;
  deactivated_dogs: number;
};

export async function POST(request: Request) {
  try {
    const authorizationHeader = request.headers.get("authorization");

    const accessToken = authorizationHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "You must be signed in to deactivate your account.",
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

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        active
        `,
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        {
          error: profileError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          error: "Your customer profile could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    if (!profile.active) {
      return NextResponse.json(
        {
          error: "Your account is already inactive.",
        },
        {
          status: 409,
        },
      );
    }

    /*
     * The database function checks active bookings,
     * deactivates every active dog and deactivates
     * the customer profile in one transaction.
     */
    const { data: deactivationRows, error: deactivationError } =
      await supabaseAdmin.rpc("deactivate_customer_account_atomic", {
        p_customer_id: user.id,
      });

    if (deactivationError) {
      console.error(
        "Atomic customer account deactivation failed:",
        deactivationError,
      );

      const errorMessage =
        deactivationError.message || "Your account could not be deactivated.";

      if (errorMessage.includes("ACTIVE_BOOKINGS_EXIST")) {
        return NextResponse.json(
          {
            error:
              "Your account cannot be deactivated while you have an active booking. Please cancel or complete all active bookings first.",
          },
          {
            status: 409,
          },
        );
      }

      if (errorMessage.includes("CUSTOMER_NOT_FOUND")) {
        return NextResponse.json(
          {
            error: "Your customer profile could not be found.",
          },
          {
            status: 404,
          },
        );
      }

      if (errorMessage.includes("CUSTOMER_ALREADY_INACTIVE")) {
        return NextResponse.json(
          {
            error: "Your account is already inactive.",
          },
          {
            status: 409,
          },
        );
      }

      if (errorMessage.includes("CUSTOMER_DEACTIVATION_FAILED")) {
        return NextResponse.json(
          {
            error:
              "Your account status changed before deactivation completed. Please refresh the page and try again.",
          },
          {
            status: 409,
          },
        );
      }

      return NextResponse.json(
        {
          error: errorMessage,
        },
        {
          status: 500,
        },
      );
    }

    const deactivationResult = Array.isArray(deactivationRows)
      ? (deactivationRows[0] as DeactivationResult | undefined)
      : (deactivationRows as DeactivationResult | null);

    if (!deactivationResult) {
      return NextResponse.json(
        {
          error: "Account deactivation completed without returning a result.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,
      accountDeactivated: true,
      customerId: deactivationResult.customer_id,
      deactivatedDogs: Number(deactivationResult.deactivated_dogs || 0),
      message: "Your account has been deactivated successfully.",
    });
  } catch (error) {
    console.error("Customer account deactivation failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to deactivate your account.",
      },
      {
        status: 500,
      },
    );
  }
}
