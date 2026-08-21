import { supabase } from "@/lib/supabase";

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = "/";
}

export async function getActivePricingSettings(effectiveDate?: string) {
  const pricingDate = effectiveDate || new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
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
    .lte("effective_from", pricingDate)
    .order("effective_from", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("You must be logged in to view this page.");
  }

  return user;
}

export async function getOptionalCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function ensureActiveAdminUser() {
  let user;

  try {
    user = await getCurrentUser();
  } catch {
    return {
      user: null,
      redirectTo: "/login",
    };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("active, is_admin")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    await supabase.auth.signOut();

    return {
      user: null,
      redirectTo: "/login",
    };
  }

  if (!profile.active) {
    await supabase.auth.signOut();

    return {
      user: null,
      redirectTo: "/",
    };
  }

  if (!profile.is_admin) {
    return {
      user: null,
      redirectTo: "/dashboard",
    };
  }

  return {
    user,
    redirectTo: null,
  };
}
