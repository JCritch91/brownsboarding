import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { formatName, validateDogDetails } from "@/lib/helpers";
import { ACTIVE_BOOKING_STATUSES } from "@/types/booking";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type UpdateDogRequest = {
  name?: unknown;
  breed?: unknown;
  date_of_birth?: unknown;
  weight_kg?: unknown;
  gender?: unknown;
  neutered?: unknown;
  vaccinated?: unknown;
  vaccination_expiry?: unknown;
  microchip_number?: unknown;
  medical_notes?: unknown;
  medication_notes?: unknown;
  feeding_notes?: unknown;
  behaviour_notes?: unknown;
};

type RouteContext = {
  params: Promise<{
    dogId: string;
  }>;
};

function optionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { dogId } = await context.params;

    if (!dogId?.trim()) {
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

    const accessToken = authorizationHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "You must be signed in to edit a dog.",
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

    if (!profile || !profile.active) {
      return NextResponse.json(
        {
          error: "Your account is not authorised to edit dogs.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * Restrict the lookup by both dog ID and the
     * authenticated customer's ID.
     */
    const { data: existingDog, error: dogLoadError } = await supabaseAdmin
      .from("dogs")
      .select(
        `
        id,
        owner_id,
        active,
        meet_and_greet_completed
        `,
      )
      .eq("id", dogId)
      .eq("owner_id", user.id)
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
          error: "This dog could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    if (!existingDog.active) {
      return NextResponse.json(
        {
          error: "An inactive dog cannot be edited.",
        },
        {
          status: 409,
        },
      );
    }

    const body = (await request.json()) as UpdateDogRequest;

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
        medical_notes: form.medical_notes || null,
        medication_notes: form.medication_notes || null,
        feeding_notes: form.feeding_notes || null,
        behaviour_notes: form.behaviour_notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dogId)
      .eq("owner_id", user.id)
      .eq("active", true)
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
            "The dog could not be updated because it was not found or is no longer active.",
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
      message: "Your dog's details have been updated successfully.",
    });
  } catch (error) {
    console.error("Customer dog update failed:", error);

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

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { dogId } = await context.params;

    if (!dogId?.trim()) {
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

    const accessToken = authorizationHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "You must be signed in to remove a dog.",
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

    if (!profile || !profile.active) {
      return NextResponse.json(
        {
          error: "Your account is not authorised to remove dogs.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * Restrict the dog lookup by both the dog ID and
     * the authenticated customer ID.
     */
    const { data: dog, error: dogLoadError } = await supabaseAdmin
      .from("dogs")
      .select(
        `
        id,
        owner_id,
        name,
        active
        `,
      )
      .eq("id", dogId)
      .eq("owner_id", user.id)
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

    if (!dog) {
      return NextResponse.json(
        {
          error: "This dog could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    if (!dog.active) {
      return NextResponse.json(
        {
          error: "This dog has already been removed.",
        },
        {
          status: 409,
        },
      );
    }

    /*
     * A dog cannot be deactivated while associated
     * with any active booking lifecycle stage.
     */
    const { count: activeBookingCount, error: bookingCheckError } =
      await supabaseAdmin
        .from("bookings")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("dog_id", dog.id)
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
            "This dog cannot be removed because it has an active booking. Please cancel or complete the booking first.",
        },
        {
          status: 409,
        },
      );
    }

    /*
     * Soft-delete the dog so historic bookings and
     * associated records remain intact.
     */
    const { data: deactivatedDog, error: deactivateError } = await supabaseAdmin
      .from("dogs")
      .update({
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dog.id)
      .eq("owner_id", user.id)
      .eq("active", true)
      .select(
        `
        id,
        owner_id,
        name,
        active
        `,
      )
      .maybeSingle();

    if (deactivateError) {
      return NextResponse.json(
        {
          error: deactivateError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!deactivatedDog) {
      return NextResponse.json(
        {
          error:
            "The dog could not be removed because its status changed before the request completed.",
        },
        {
          status: 409,
        },
      );
    }

    return NextResponse.json({
      success: true,
      dogDeactivated: true,
      dog: {
        id: deactivatedDog.id,
        ownerId: deactivatedDog.owner_id,
        name: deactivatedDog.name,
        active: deactivatedDog.active,
      },
      message: "Your dog has been removed successfully.",
    });
  } catch (error) {
    console.error("Customer dog deactivation failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to remove the dog.",
      },
      {
        status: 500,
      },
    );
  }
}
