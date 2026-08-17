import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  formatAddressLine,
  formatName,
  formatPostcode,
  formatUkPhone,
} from "@/lib/helpers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RouteContext = {
  params: Promise<{
    customerId: string;
  }>;
};

type UpdateCustomerRequest = {
  first_name?: unknown;
  last_name?: unknown;
  phone?: unknown;
  address_line_1?: unknown;
  address_line_2?: unknown;
  town?: unknown;
  postcode?: unknown;
  emergency_contact_name?: unknown;
  emergency_contact_phone?: unknown;
  vet_name?: unknown;
  vet_phone?: unknown;
  vet_address?: unknown;
};

function optionalString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

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
          error: adminProfileError.message,
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
            "You do not have permission to update customers.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      data: existingCustomer,
      error: customerLoadError,
    } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        email,
        is_admin
        `
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
        }
      );
    }

    if (!existingCustomer) {
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

    /*
     * This route edits customer details only.
     * Administrator profiles must be managed through
     * the separate role-management workflow.
     */
    if (existingCustomer.is_admin === true) {
      return NextResponse.json(
        {
          error:
            "Administrator profiles cannot be edited through the customer details route.",
        },
        {
          status: 409,
        }
      );
    }

    const body =
      (await request.json()) as UpdateCustomerRequest;

    const firstName = formatName(
      optionalString(body.first_name)
    );

    const lastName = formatName(
      optionalString(body.last_name)
    );

    if (!firstName || !lastName) {
      return NextResponse.json(
        {
          error:
            "First name and last name are required.",
        },
        {
          status: 400,
        }
      );
    }

    const phone = formatUkPhone(
      optionalString(body.phone)
    );

    const addressLine1 =
      formatAddressLine(
        optionalString(body.address_line_1)
      );

    const addressLine2 =
      formatAddressLine(
        optionalString(body.address_line_2)
      );

    const town = formatName(
      optionalString(body.town)
    );

    const postcode = formatPostcode(
      optionalString(body.postcode)
    );

    const emergencyContactName =
      formatName(
        optionalString(
          body.emergency_contact_name
        )
      );

    const emergencyContactPhone =
      formatUkPhone(
        optionalString(
          body.emergency_contact_phone
        )
      );

    const vetName = formatName(
      optionalString(body.vet_name)
    );

    const vetPhone = formatUkPhone(
      optionalString(body.vet_phone)
    );

    const vetAddress =
      formatAddressLine(
        optionalString(body.vet_address)
      );

    const {
      data: updatedCustomer,
      error: updateError,
    } = await supabaseAdmin
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        address_line_1:
          addressLine1 || null,
        address_line_2:
          addressLine2 || null,
        town: town || null,
        postcode: postcode || null,
        emergency_contact_name:
          emergencyContactName || null,
        emergency_contact_phone:
          emergencyContactPhone || null,
        vet_name: vetName || null,
        vet_phone: vetPhone || null,
        vet_address: vetAddress || null,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", customerId)
      .or(
        "is_admin.eq.false,is_admin.is.null"
      )
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
        emergency_contact_phone,
        vet_name,
        vet_phone,
        vet_address,
        active,
        is_admin
        `
      )
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        {
          error: updateError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!updatedCustomer) {
      return NextResponse.json(
        {
          error:
            "The customer could not be updated because the record changed before the request completed.",
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json({
      success: true,
      customerUpdated: true,
      customer: updatedCustomer,
      message:
        "The customer details have been updated successfully.",
    });
  } catch (error) {
    console.error(
      "Admin customer update failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update the customer.",
      },
      {
        status: 500,
      }
    );
  }
}