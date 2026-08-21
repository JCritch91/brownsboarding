import { createClient } from "@supabase/supabase-js";

export const VACCINATION_PROOF_BUCKET = "dog-vaccination-proofs";
export const VACCINATION_PROOF_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const VACCINATION_PROOF_SIGNED_URL_EXPIRY_SECONDS = 60;

export const VACCINATION_PROOF_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type VaccinationProofMimeType =
  (typeof VACCINATION_PROOF_ALLOWED_MIME_TYPES)[number];

export type VaccinationProofRecord = {
  id: string;
  dog_id: string;
  storage_path: string | null;
  original_file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  vaccination_expiry: string;
  uploaded_at: string | null;
  checked_at: string | null;
  checked_by: string | null;
  deleted_at: string | null;
  deletion_reason: string | null;
  created_at: string;
  updated_at: string;
};

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

export function getBearerToken(request: Request) {
  const authorizationHeader = request.headers.get("authorization");

  return authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice(7).trim()
    : "";
}

export function isAllowedVaccinationProofMimeType(
  mimeType: string,
): mimeType is VaccinationProofMimeType {
  return VACCINATION_PROOF_ALLOWED_MIME_TYPES.includes(
    mimeType as VaccinationProofMimeType,
  );
}

export function getVaccinationProofFileExtension(mimeType: string) {
  switch (mimeType) {
    case "application/pdf":
      return "pdf";

    case "image/jpeg":
      return "jpg";

    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    default:
      return "";
  }
}

export function isValidDatabaseDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function getCurrentDatabaseDate() {
  return new Date().toISOString().slice(0, 10);
}

export function sanitiseOriginalFileName(fileName: string) {
  const normalisedName = fileName
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._ -]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalisedName.slice(0, 200) || "vaccination-proof";
}

export function buildVaccinationProofStoragePath({
  ownerId,
  dogId,
  proofId,
  mimeType,
}: {
  ownerId: string;
  dogId: string;
  proofId: string;
  mimeType: string;
}) {
  const extension = getVaccinationProofFileExtension(mimeType);

  if (!extension) {
    throw new Error("The vaccination proof file type is not supported.");
  }

  return `${ownerId}/${dogId}/${proofId}.${extension}`;
}

export function getVaccinationProofStatus(
  proof: VaccinationProofRecord | null,
) {
  if (!proof?.storage_path || proof.deleted_at) {
    return "due" as const;
  }

  if (proof.vaccination_expiry < getCurrentDatabaseDate()) {
    return "expired" as const;
  }

  if (!proof.checked_at || !proof.checked_by) {
    return "awaiting-review" as const;
  }

  return "checked" as const;
}

export async function authenticateVaccinationProofRequest(request: Request) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return {
      user: null,
      error: "You must be signed in.",
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

  if (!profile?.active) {
    return {
      user: null,
      error: "Your account is inactive.",
      status: 403,
    };
  }

  return {
    user,
    profile,
    error: "",
    status: 200,
  };
}
