import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

type PricingRequest = {
  boardingNightlyRate?: unknown;
  boardingDepositPercentage?: unknown;
  daycareFullDayRate?: unknown;
  daycareHalfDayRate?: unknown;
  daycareDepositPercentage?: unknown;
  effectiveFrom?: unknown;
};

async function ensureAdmin(request: Request) {
  const authorizationHeader = request.headers.get("authorization");

  const accessToken = authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice(7).trim()
    : "";

  if (!accessToken) {
    return {
      user: null,
      error: "You must be signed in as an administrator.",
      status: 401,
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (userError || !user) {
    return {
      user: null,
      error: "Unable to verify the signed-in user.",
      status: 401,
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, active, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      user: null,
      error: profileError.message,
      status: 500,
    };
  }

  if (!profile?.active || !profile.is_admin) {
    return {
      user: null,
      error: "You do not have permission to manage pricing.",
      status: 403,
    };
  }

  return {
    user,
    error: "",
    status: 200,
  };
}

function isValidDatabaseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === value
  );
}

function isValidRate(value: number) {
  return Number.isFinite(value) && value > 0 && value <= 99999999.99;
}

function isValidPercentage(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

export async function GET(request: Request) {
  try {
    const authentication = await ensureAdmin(request);

    if (!authentication.user) {
      return NextResponse.json(
        {
          error: authentication.error,
        },
        {
          status: authentication.status,
        },
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    const { data: pricing, error: pricingError } = await supabaseAdmin
      .from("pricing_settings")
      .select(
        `
        id,
        name,
        nightly_rate,
        deposit_percentage,
        daycare_full_day_rate,
        daycare_half_day_rate,
        daycare_deposit_percentage,
        effective_from,
        active,
        created_at,
        updated_at
        `,
      )
      .eq("active", true)
      .lte("effective_from", today)
      .order("effective_from", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (pricingError) {
      return NextResponse.json(
        {
          error: pricingError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!pricing) {
      return NextResponse.json(
        {
          error: "No current pricing settings could be found.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      success: true,
      pricing,
    });
  } catch (error) {
    console.error("Administrator pricing load failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load the current pricing.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
  try {
    const authentication = await ensureAdmin(request);

    if (!authentication.user) {
      return NextResponse.json(
        {
          error: authentication.error,
        },
        {
          status: authentication.status,
        },
      );
    }

    let body: PricingRequest;

    try {
      body = (await request.json()) as PricingRequest;
    } catch {
      return NextResponse.json(
        {
          error: "The pricing request is invalid.",
        },
        {
          status: 400,
        },
      );
    }

    const boardingNightlyRate = Number(body.boardingNightlyRate);
    const boardingDepositPercentage = Number(body.boardingDepositPercentage);
    const daycareFullDayRate = Number(body.daycareFullDayRate);
    const daycareHalfDayRate = Number(body.daycareHalfDayRate);
    const daycareDepositPercentage = Number(body.daycareDepositPercentage);

    const effectiveFrom =
      typeof body.effectiveFrom === "string" ? body.effectiveFrom.trim() : "";

    if (!isValidDatabaseDate(effectiveFrom)) {
      return NextResponse.json(
        {
          error: "Please enter a valid effective date.",
        },
        {
          status: 400,
        },
      );
    }

    if (!isValidRate(boardingNightlyRate)) {
      return NextResponse.json(
        {
          error: "The boarding nightly rate must be greater than zero.",
        },
        {
          status: 400,
        },
      );
    }

    if (!isValidPercentage(boardingDepositPercentage)) {
      return NextResponse.json(
        {
          error: "The boarding deposit percentage must be between 0 and 100.",
        },
        {
          status: 400,
        },
      );
    }

    if (!isValidRate(daycareFullDayRate)) {
      return NextResponse.json(
        {
          error: "The daycare full-day rate must be greater than zero.",
        },
        {
          status: 400,
        },
      );
    }

    if (!isValidRate(daycareHalfDayRate)) {
      return NextResponse.json(
        {
          error: "The daycare half-day rate must be greater than zero.",
        },
        {
          status: 400,
        },
      );
    }

    if (daycareHalfDayRate >= daycareFullDayRate) {
      return NextResponse.json(
        {
          error:
            "The daycare half-day rate must be less than the full-day rate.",
        },
        {
          status: 400,
        },
      );
    }

    if (!isValidPercentage(daycareDepositPercentage)) {
      return NextResponse.json(
        {
          error: "The daycare deposit percentage must be between 0 and 100.",
        },
        {
          status: 400,
        },
      );
    }

    const { data: existingPricing, error: existingPricingError } =
      await supabaseAdmin
        .from("pricing_settings")
        .select("id")
        .eq("effective_from", effectiveFrom)
        .eq("active", true)
        .limit(1)
        .maybeSingle();

    if (existingPricingError) {
      return NextResponse.json(
        {
          error: existingPricingError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (existingPricing) {
      return NextResponse.json(
        {
          error:
            "An active pricing version already exists for the selected effective date.",
        },
        {
          status: 409,
        },
      );
    }

    const insertedAt = new Date().toISOString();

    const { data: pricing, error: insertError } = await supabaseAdmin
      .from("pricing_settings")
      .insert({
        name: `Pricing ${effectiveFrom}`,
        nightly_rate: boardingNightlyRate,
        deposit_percentage: boardingDepositPercentage,
        daycare_full_day_rate: daycareFullDayRate,
        daycare_half_day_rate: daycareHalfDayRate,
        daycare_deposit_percentage: daycareDepositPercentage,
        effective_from: effectiveFrom,
        active: true,
        updated_at: insertedAt,
      })
      .select(
        `
        id,
        name,
        nightly_rate,
        deposit_percentage,
        daycare_full_day_rate,
        daycare_half_day_rate,
        daycare_deposit_percentage,
        effective_from,
        active,
        created_at,
        updated_at
        `,
      )
      .single();

    if (insertError) {
      return NextResponse.json(
        {
          error: insertError.message,
        },
        {
          status: insertError.code === "23505" ? 409 : 500,
        },
      );
    }

    return NextResponse.json(
      {
        success: true,
        pricingCreated: true,
        pricing,
        message:
          effectiveFrom > new Date().toISOString().slice(0, 10)
            ? `The new pricing version was scheduled for ${effectiveFrom}.`
            : "The new pricing version is now effective.",
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Administrator pricing creation failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create the pricing version.",
      },
      {
        status: 500,
      },
    );
  }
}
