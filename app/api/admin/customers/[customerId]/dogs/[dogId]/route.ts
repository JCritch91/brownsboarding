import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { formatName, validateDogDetails } from "@/lib/helpers";

import { ACTIVE_BOOKING_STATUSES } from "@/types/booking";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type RouteContext = {
  params: Promise<{
    customerId: string;
    dogId: string;
  }>;
};

type UpdateAdminDogRequest = {
  name?: unknown;
  breed?: unknown;
  date_of_birth?: unknown;
  weight_kg?: unknown;
  gender?: unknown;
  neutered?: unknown;
  vaccinated?: unknown;
  vaccination_expiry?: unknown;
  microchip_number?: unknown;
  vet_address?: unknown;
  can_share_with_other_dogs?: unknown;
  medical_notes?: unknown;
  medication_notes?: unknown;
  feeding_notes?: unknown;
  behaviour_notes?: unknown;
  meetAndGreetCompleted?: unknown;
  active?: unknown;
};

function optionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { customerId, dogId } = await context.params;

    if (!customerId.trim()) {
      return NextResponse.json(
        {
          error: "Customer ID is missing.",
        },
        {
          status: 400,
        },
      );
    }

    if (!dogId.trim()) {
      return NextResponse.json(
        {
          error: "Dog ID is missing.",
        },
        {
          status: 400,
        },
      );
    }

    const authorizationHeader = request.headers.get("authorization");

    const accessToken = authorizationHeader?.startsWith("Bearer ")
      ? authorizationHeader.slice(7)
      : null;

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
          error: "You do not have permission to edit customer dogs.",
        },
        {
          status: 403,
        },
      );
    }

    const { data: customer, error: customerLoadError } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
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

    if (customer.is_admin === true) {
      return NextResponse.json(
        {
          error:
            "Dogs cannot be managed through the customer workflow for an administrator profile.",
        },
        {
          status: 409,
        },
      );
    }

    const { data: existingDog, error: dogLoadError } = await supabaseAdmin
      .from("dogs")
      .select(
        `
        id,
        owner_id,
        name,
        active,
        meet_and_greet_completed
        `,
      )
      .eq("id", dogId)
      .eq("owner_id", customer.id)
      .maybeSingle();

    if (dogLoadError) {
      return NextResponse.json(
        {
          error: dogLoadError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!existingDog) {
      return NextResponse.json(
        {
          error: "The dog could not be found for this customer.",
        },
        {
          status: 404,
        },
      );
    }

    const body = (await request.json()) as UpdateAdminDogRequest;

    if (typeof body.meetAndGreetCompleted !== "boolean") {
      return NextResponse.json(
        {
          error: "The Meet & Greet completion status is invalid.",
        },
        {
          status: 400,
        },
      );
    }

    if (typeof body.active !== "boolean") {
      return NextResponse.json(
        {
          error: "The requested dog status is invalid.",
        },
        {
          status: 400,
        },
      );
    }

    const form = {
      name: optionalString(body.name),
      breed: optionalString(body.breed),
      date_of_birth: optionalString(body.date_of_birth),
      weight_kg: optionalString(body.weight_kg),
      gender: optionalString(body.gender),
      neutered: optionalString(body.neutered),
      vaccinated: optionalString(body.vaccinated),
      vaccination_expiry: optionalString(body.vaccination_expiry),
      microchip_number: optionalString(body.microchip_number),
      vet_address: optionalString(body.vet_address),
      can_share_with_other_dogs: optionalString(body.can_share_with_other_dogs),
      medical_notes: optionalString(body.medical_notes),
      medication_notes: optionalString(body.medication_notes),
      feeding_notes: optionalString(body.feeding_notes),
      behaviour_notes: optionalString(body.behaviour_notes),
    };

    const validationMessage = validateDogDetails(form);

    if (validationMessage) {
      return NextResponse.json(
        {
          error: validationMessage,
        },
        {
          status: 400,
        },
      );
    }

    if (
      form.can_share_with_other_dogs !== "yes" &&
      form.can_share_with_other_dogs !== "no"
    ) {
      return NextResponse.json(
        {
          error:
            "Please confirm whether the dog can share with dogs from other households.",
        },
        {
          status: 400,
        },
      );
    }

    const weight = form.weight_kg === "" ? null : Number(form.weight_kg);

    if (weight !== null && (!Number.isFinite(weight) || weight <= 0)) {
      return NextResponse.json(
        {
          error: "Please enter a valid weight.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * An active dog cannot be deactivated while it
     * has a booking in an active lifecycle stage.
     */
    if (existingDog.active && !body.active) {
      const { count: activeBookingCount, error: bookingCheckError } =
        await supabaseAdmin
          .from("bookings")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("dog_id", existingDog.id)
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
              "This dog cannot be deactivated while it has an active booking. Cancel or complete all active bookings first.",
          },
          {
            status: 409,
          },
        );
      }
    }

    const { data: updatedDog, error: updateError } = await supabaseAdmin
      .from("dogs")
      .update({
        name: formatName(form.name),
        breed: formatName(form.breed) || null,
        date_of_birth: form.date_of_birth || null,
        weight_kg: weight,
        gender: form.gender || null,
        neutered: form.neutered === "yes",
        vaccinated: form.vaccinated === "yes",
        vaccination_expiry:
          form.vaccinated === "yes" ? form.vaccination_expiry || null : null,
        microchip_number: form.microchip_number || null,
        vet_address: form.vet_address || null,
        can_share_with_other_dogs: form.can_share_with_other_dogs === "yes",
        medical_notes: form.medical_notes || null,
        medication_notes: form.medication_notes || null,
        feeding_notes: form.feeding_notes || null,
        behaviour_notes: form.behaviour_notes || null,
        meet_and_greet_completed: body.meetAndGreetCompleted,
        active: body.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingDog.id)
      .eq("owner_id", customer.id)
      .eq("active", existingDog.active)
      .select(
        `
        id,
        owner_id,
        name,
        active,
        meet_and_greet_completed
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

    if (!updatedDog) {
      return NextResponse.json(
        {
          error:
            "The dog could not be updated because its status changed before the request completed. Refresh the page and try again.",
        },
        {
          status: 409,
        },
      );
    }

    return NextResponse.json({
      success: true,
      dogUpdated: true,
      dog: {
        id: updatedDog.id,
        ownerId: updatedDog.owner_id,
        name: updatedDog.name,
        active: updatedDog.active,
        meetAndGreetCompleted: updatedDog.meet_and_greet_completed,
      },
      message: "The dog's details have been updated successfully.",
    });
  } catch (error) {
    console.error("Admin customer dog update failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update the dog.",
      },
      {
        status: 500,
      },
    );
  }
}
