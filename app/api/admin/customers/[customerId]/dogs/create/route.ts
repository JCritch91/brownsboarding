import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { formatName, validateDogDetails } from "@/lib/helpers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type RouteContext = {
  params: Promise<{
    customerId: string;
  }>;
};

type CreateAdminDogRequest = {
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
  meetAndGreetCompleted?: unknown;
};

function optionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request, context: RouteContext) {
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
          error: "You do not have permission to add dogs for customers.",
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
            "Dogs cannot be added through the customer workflow for an administrator profile.",
        },
        {
          status: 409,
        },
      );
    }

    if (!customer.active) {
      return NextResponse.json(
        {
          error: "A dog cannot be added to an inactive customer account.",
        },
        {
          status: 409,
        },
      );
    }

    const body = (await request.json()) as CreateAdminDogRequest;

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

    const { data: createdDog, error: createError } = await supabaseAdmin
      .from("dogs")
      .insert({
        owner_id: customer.id,
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
        meet_and_greet_completed: body.meetAndGreetCompleted,
        active: true,
        updated_at: new Date().toISOString(),
      })
      .select(
        `
        id,
        owner_id,
        name,
        active,
        meet_and_greet_completed
        `,
      )
      .single();

    if (createError || !createdDog) {
      return NextResponse.json(
        {
          error: createError?.message || "The dog could not be added.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json(
      {
        success: true,
        dogCreated: true,
        dog: {
          id: createdDog.id,
          ownerId: createdDog.owner_id,
          name: createdDog.name,
          active: createdDog.active,
          meetAndGreetCompleted: createdDog.meet_and_greet_completed,
        },
        message: "The dog has been added successfully.",
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Admin customer dog creation failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to add the dog.",
      },
      {
        status: 500,
      },
    );
  }
}
