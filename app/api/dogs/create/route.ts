import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  formatName,
  validateDogDetails,
} from "@/lib/helpers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type CreateDogRequest = {
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

function optionalString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export async function POST(request: Request) {
  try {
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
            "You must be signed in to add a dog.",
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
      data: profile,
      error: profileError,
    } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        active
        `
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
        }
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          error:
            "Your customer account could not be found.",
        },
        {
          status: 404,
        }
      );
    }

    if (!profile.active) {
      return NextResponse.json(
        {
          error:
            "A dog cannot be added to an inactive account.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      (await request.json()) as CreateDogRequest;

    const form = {
      name: optionalString(body.name),
      breed: optionalString(body.breed),
      date_of_birth: optionalString(
        body.date_of_birth
      ),
      weight_kg: optionalString(
        body.weight_kg
      ),
      gender: optionalString(body.gender),
      neutered: optionalString(
        body.neutered
      ),
      vaccinated: optionalString(
        body.vaccinated
      ),
      vaccination_expiry: optionalString(
        body.vaccination_expiry
      ),
      microchip_number: optionalString(
        body.microchip_number
      ),
      medical_notes: optionalString(
        body.medical_notes
      ),
      medication_notes: optionalString(
        body.medication_notes
      ),
      feeding_notes: optionalString(
        body.feeding_notes
      ),
      behaviour_notes: optionalString(
        body.behaviour_notes
      ),
    };

    const validationMessage =
      validateDogDetails(form);

    if (validationMessage) {
      return NextResponse.json(
        {
          error: validationMessage,
        },
        {
          status: 400,
        }
      );
    }

    const weight =
      form.weight_kg === ""
        ? null
        : Number(form.weight_kg);

    if (
      weight !== null &&
      (!Number.isFinite(weight) || weight <= 0)
    ) {
      return NextResponse.json(
        {
          error:
            "Please enter a valid weight.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: dog,
      error: createError,
    } = await supabaseAdmin
      .from("dogs")
      .insert({
        owner_id: user.id,
        name: formatName(form.name),
        breed:
          formatName(form.breed) || null,
        date_of_birth:
          form.date_of_birth || null,
        weight_kg: weight,
        gender: form.gender || null,
        neutered:
          form.neutered === "yes",
        vaccinated:
          form.vaccinated === "yes",
        vaccination_expiry:
          form.vaccinated === "yes"
            ? form.vaccination_expiry ||
              null
            : null,
        microchip_number:
          form.microchip_number || null,
        medical_notes:
          form.medical_notes || null,
        medication_notes:
          form.medication_notes || null,
        feeding_notes:
          form.feeding_notes || null,
        behaviour_notes:
          form.behaviour_notes || null,
        meet_and_greet_completed: false,
        active: true,
        updated_at:
          new Date().toISOString(),
      })
      .select(
        `
        id,
        owner_id,
        name,
        active,
        meet_and_greet_completed
        `
      )
      .single();

    if (createError || !dog) {
      return NextResponse.json(
        {
          error:
            createError?.message ||
            "The dog could not be added.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        dogCreated: true,
        dog: {
          id: dog.id,
          ownerId: dog.owner_id,
          name: dog.name,
          active: dog.active,
          meetAndGreetCompleted:
            dog.meet_and_greet_completed,
        },
        message:
          "Your dog has been added successfully.",
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Customer dog creation failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to add the dog.",
      },
      {
        status: 500,
      }
    );
  }
}