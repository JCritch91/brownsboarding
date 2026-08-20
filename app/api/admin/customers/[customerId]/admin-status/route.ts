import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RouteContext = {
  params: Promise<{
    customerId: string;
  }>;
};

type UpdateAdminStatusRequest = {
  isAdmin?: unknown;
};

export async function PATCH(
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
            "You do not have permission to manage administrator access.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      (await request.json()) as UpdateAdminStatusRequest;

    if (typeof body.isAdmin !== "boolean") {
      return NextResponse.json(
        {
          error:
            "The requested administrator status is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    const requestedAdminStatus =
      body.isAdmin;

    /*
     * Prevent an administrator from removing their
     * own access. This must be enforced on the server,
     * even though the page also performs this check.
     */
    if (
      customerId === user.id &&
      !requestedAdminStatus
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot remove your own administrator access.",
        },
        {
          status: 409,
        }
      );
    }

    const {
      data: targetProfile,
      error: targetLoadError,
    } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        first_name,
        last_name,
        email,
        active,
        is_admin
        `
      )
      .eq("id", customerId)
      .maybeSingle();

    if (targetLoadError) {
      return NextResponse.json(
        {
          error:
            targetLoadError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!targetProfile) {
      return NextResponse.json(
        {
          error:
            "The selected profile could not be found.",
        },
        {
          status: 404,
        }
      );
    }

    const existingAdminStatus =
      targetProfile.is_admin === true;

    if (
      existingAdminStatus ===
      requestedAdminStatus
    ) {
      return NextResponse.json({
        success: true,
        adminStatusUpdated: true,
        profile: {
          id: targetProfile.id,
          isAdmin:
            existingAdminStatus,
        },
        message: requestedAdminStatus
          ? "Administrator access is already enabled."
          : "Administrator access has already been removed.",
      });
    }

    const {
      data: updatedProfile,
      error: updateError,
    } = await supabaseAdmin
      .from("profiles")
      .update({
        is_admin:
          requestedAdminStatus,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", targetProfile.id)
      .eq(
        "is_admin",
        existingAdminStatus
      )
      .select(
        `
        id,
        is_admin
        `
      )
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        {
          error:
            updateError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!updatedProfile) {
      return NextResponse.json(
        {
          error:
            "The administrator status changed before the request completed. Refresh the page and try again.",
        },
        {
          status: 409,
        }
      );
    }

    const isAdmin =
      updatedProfile.is_admin === true;

    return NextResponse.json({
      success: true,
      adminStatusUpdated: true,
      profile: {
        id: updatedProfile.id,
        isAdmin,
      },
      message: isAdmin
        ? "Administrator access granted."
        : "Administrator access removed.",
    });
  } catch (error) {
    console.error(
      "Admin role-management update failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update administrator access.",
      },
      {
        status: 500,
      }
    );
  }
}