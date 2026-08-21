export type VaccinationProofStatus =
  "due" | "expired" | "awaiting-review" | "checked";

export type VaccinationProofSummary = {
  dog_id: string;
  storage_path: string | null;
  vaccination_expiry: string;
  checked_at: string | null;
  checked_by: string | null;
  deleted_at: string | null;
};

type VaccinationProofStatusOptions = {
  proof: VaccinationProofSummary | null | undefined;
  dogVaccinationExpiry?: string | null;
  today: string;
};

export function getVaccinationProofStatus({
  proof,
  dogVaccinationExpiry,
  today,
}: VaccinationProofStatusOptions): VaccinationProofStatus {
  if (!proof?.storage_path || proof.deleted_at) {
    return "due";
  }

  if (proof.vaccination_expiry < today) {
    return "expired";
  }

  if (
    dogVaccinationExpiry &&
    proof.vaccination_expiry !== dogVaccinationExpiry
  ) {
    return "due";
  }

  if (!proof.checked_at || !proof.checked_by) {
    return "awaiting-review";
  }

  return "checked";
}

export function getVaccinationProofPresentation(
  status: VaccinationProofStatus,
) {
  switch (status) {
    case "checked":
      return {
        label: "Vaccination Proof Checked",
        className: "border-green-300 bg-green-50 text-green-800",
        textClassName: "text-green-700",
      };

    case "awaiting-review":
      return {
        label: "Vaccination Proof Awaiting Review",
        className: "border-amber-300 bg-amber-50 text-amber-800",
        textClassName: "text-amber-700",
      };

    case "expired":
      return {
        label: "Vaccination Proof Expired",
        className: "border-red-300 bg-red-50 text-red-800",
        textClassName: "text-red-700",
      };

    default:
      return {
        label: "Vaccination Proof Due",
        className: "border-red-300 bg-red-50 text-red-800",
        textClassName: "text-red-700",
      };
  }
}
``;
