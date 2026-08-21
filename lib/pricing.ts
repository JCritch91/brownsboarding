import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export type PricingSettings = {
  id: string;
  name: string;
  nightly_rate: number;
  deposit_percentage: number;
  daycare_full_day_rate: number;
  daycare_half_day_rate: number;
  daycare_deposit_percentage: number;
  effective_from: string;
  active: boolean;
};

export async function getCurrentPricing() {
  const { data, error } = await supabaseAdmin
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
      active
      `,
    )
    .eq("active", true)
    .order("effective_from", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("No active pricing settings could be found.");
  }

  return data as PricingSettings;
}
