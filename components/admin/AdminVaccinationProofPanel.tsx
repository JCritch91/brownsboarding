"use client";

import { useEffect, useState } from "react";

import Button from "@/components/Buttons";
import ConfirmationModal from "@/components/modals/ConfirmationModal";
import { authenticatedApiRequest } from "@/lib/client/authenticated-api";
import { formatDisplayDate } from "@/lib/helpers";

type VaccinationProofStatus = "due" | "expired" | "awaiting-review" | "checked";

type VaccinationProof = {
  id: string;
  dogId: string;
  originalFileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  vaccinationExpiry: string;
  uploadedAt: string | null;
  checkedAt: string | null;
  checkedBy: string | null;
  status: VaccinationProofStatus;
};

type AdminVaccinationProofResponse = {
  success: boolean;
  proofAvailable?: boolean;
  proofReviewed?: boolean;
  proofRemoved?: boolean;
  alreadyRemoved?: boolean;
  followUpRequired?: boolean;
  proof?: VaccinationProof;
  signedUrl?: string;
  message?: string;
  error?: string;
};

type AdminVaccinationProofPanelProps = {
  dogId: string;
  dogName: string;
};

type ConfirmationAction = "check" | "uncheck" | "remove" | null;

function formatFileSize(fileSizeBytes: number | null) {
  if (!fileSizeBytes || fileSizeBytes <= 0) {
    return "Unknown size";
  }

  if (fileSizeBytes < 1024 * 1024) {
    return `${Math.ceil(fileSizeBytes / 1024)} KB`;
  }

  return `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getStatusPresentation(status: VaccinationProofStatus) {
  switch (status) {
    case "checked":
      return {
        label: "Vaccination Proof Checked",
        className: "border-green-300 bg-green-50 text-green-800",
        description:
          "This vaccination evidence has been checked by an administrator.",
      };

    case "awaiting-review":
      return {
        label: "Awaiting Admin Review",
        className: "border-amber-300 bg-amber-50 text-amber-800",
        description:
          "The customer has uploaded vaccination evidence that requires review.",
      };

    case "expired":
      return {
        label: "Vaccination Proof Expired",
        className: "border-red-300 bg-red-50 text-red-800",
        description:
          "The uploaded vaccination evidence has expired and cannot be approved.",
      };

    default:
      return {
        label: "Vaccination Proof Due",
        className: "border-red-300 bg-red-50 text-red-800",
        description:
          "The customer has not uploaded current vaccination evidence.",
      };
  }
}

export default function AdminVaccinationProofPanel({
  dogId,
  dogName,
}: AdminVaccinationProofPanelProps) {
  const [proof, setProof] = useState<VaccinationProof | null>(null);
  const [status, setStatus] = useState<VaccinationProofStatus>("due");
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [confirmationAction, setConfirmationAction] =
    useState<ConfirmationAction>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    loadProof();
  }, [dogId]);

  async function loadProof() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    const result = await authenticatedApiRequest<AdminVaccinationProofResponse>(
      `/api/admin/dogs/${dogId}/vaccination-proof`,
      {
        method: "GET",
      },
    );

    if (result.unauthenticated) {
      window.location.href = "/login";
      return;
    }

    if (result.status === 404) {
      setProof(null);
      setStatus("due");
      setLoading(false);
      return;
    }

    if (result.status === 410) {
      setProof(result.data?.proof || null);
      setStatus("expired");
      setLoading(false);
      return;
    }

    if (!result.ok || !result.data?.proofAvailable || !result.data.proof) {
      setProof(null);
      setStatus("due");
      setIsError(true);
      setMessage(result.error || "Vaccination evidence could not be loaded.");
      setLoading(false);
      return;
    }

    setProof(result.data.proof);
    setStatus(result.data.proof.status);
    setLoading(false);
  }

  async function openProof() {
    if (!proof || opening || processing) {
      return;
    }

    setOpening(true);
    setMessage("");
    setIsError(false);

    const result = await authenticatedApiRequest<AdminVaccinationProofResponse>(
      `/api/admin/dogs/${dogId}/vaccination-proof`,
      {
        method: "GET",
      },
    );

    setOpening(false);

    if (result.unauthenticated) {
      window.location.href = "/login";
      return;
    }

    if (!result.ok || !result.data?.signedUrl) {
      setIsError(true);
      setMessage(
        result.error ||
          "A temporary vaccination evidence link could not be created.",
      );

      if (result.status === 404) {
        setProof(null);
        setStatus("due");
      }

      if (result.status === 410) {
        setStatus("expired");
      }

      return;
    }

    window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function requestAction(action: Exclude<ConfirmationAction, null>) {
    if (processing || opening) {
      return;
    }

    setMessage("");
    setIsError(false);
    setConfirmationAction(action);
  }

  async function confirmAction() {
    if (!confirmationAction || processing) {
      return;
    }

    setProcessing(true);
    setMessage("");
    setIsError(false);

    const result =
      confirmationAction === "remove"
        ? await authenticatedApiRequest<AdminVaccinationProofResponse>(
            `/api/admin/dogs/${dogId}/vaccination-proof`,
            {
              method: "DELETE",
            },
          )
        : await authenticatedApiRequest<AdminVaccinationProofResponse>(
            `/api/admin/dogs/${dogId}/vaccination-proof`,
            {
              method: "PATCH",
              body: {
                checked: confirmationAction === "check",
              },
            },
          );

    setProcessing(false);
    setConfirmationAction(null);

    if (result.unauthenticated) {
      window.location.href = "/login";
      return;
    }

    if (!result.ok) {
      setIsError(true);
      setMessage(
        result.error ||
          "The vaccination evidence action could not be completed.",
      );
      return;
    }

    if (confirmationAction === "remove") {
      if (!result.data?.proofRemoved) {
        setIsError(true);
        setMessage(
          result.data?.error || "The vaccination evidence was not removed.",
        );
        return;
      }

      setProof(null);
      setStatus("due");

      if (result.data.followUpRequired) {
        setIsError(true);
        setMessage(
          result.data.message ||
            "The file was removed, but its database record requires review.",
        );
        return;
      }
    } else {
      if (!result.data?.proofReviewed || !result.data.proof) {
        setIsError(true);
        setMessage(
          result.data?.error ||
            "The vaccination evidence review status was not updated.",
        );
        return;
      }

      setProof(result.data.proof);
      setStatus(result.data.proof.status);
    }

    setIsError(false);
    setMessage(
      result.data?.message ||
        "The vaccination evidence action completed successfully.",
    );
  }

  const statusPresentation = getStatusPresentation(status);

  const confirmationContent = {
    check: {
      title: "Mark Vaccination Evidence as Checked",
      confirmText: "Mark as Checked",
      variant: "primary" as const,
      description:
        "Confirm that the uploaded document has been reviewed and matches the dog's current vaccination details.",
    },
    uncheck: {
      title: "Return Evidence to Review",
      confirmText: "Mark as Awaiting Review",
      variant: "warning" as const,
      description:
        "The evidence will no longer be recorded as checked and will return to the administrator review queue.",
    },
    remove: {
      title: "Remove Vaccination Evidence",
      confirmText: "Remove Evidence",
      variant: "danger" as const,
      description:
        "The uploaded document will be permanently deleted and vaccination proof will become due.",
    },
  };

  const activeConfirmation = confirmationAction
    ? confirmationContent[confirmationAction]
    : null;

  return (
    <>
      <section className="rounded-xl border border-[#D9CBB8] bg-[#FFFDF9] p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#5C4033] md:text-xl">
              Vaccination Evidence
            </h2>

            <p className="mt-1 text-sm text-[#8B6A4E] md:text-base">
              Review the current vaccination evidence for {dogName}.
            </p>
          </div>

          {!loading && (
            <span
              className={`inline-flex w-fit rounded-lg border px-3 py-1.5 text-xs font-semibold md:text-sm ${statusPresentation.className}`}
            >
              {statusPresentation.label}
            </span>
          )}
        </div>

        {loading ? (
          <p className="mt-5 text-sm text-[#8B6A4E] md:text-base">
            Loading vaccination evidence...
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            <div
              className={`rounded-lg border p-3 md:p-4 ${statusPresentation.className}`}
            >
              <p className="text-sm font-medium md:text-base">
                {statusPresentation.description}
              </p>
            </div>

            {message && (
              <div
                className={`rounded-lg border p-3 md:p-4 ${
                  isError
                    ? "border-red-300 bg-red-50 text-red-800"
                    : "border-green-300 bg-green-50 text-green-800"
                }`}
              >
                <p className="text-sm font-medium md:text-base">{message}</p>
              </div>
            )}

            {proof && status !== "expired" && (
              <dl className="grid gap-3 rounded-lg border border-[#D9CBB8] bg-white p-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold text-[#8B6A4E]">File</dt>
                  <dd className="mt-1 break-all text-sm font-medium text-[#5C4033] md:text-base">
                    {proof.originalFileName || "Vaccination evidence"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold text-[#8B6A4E]">
                    File size
                  </dt>
                  <dd className="mt-1 text-sm text-[#5C4033] md:text-base">
                    {formatFileSize(proof.fileSizeBytes)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold text-[#8B6A4E]">
                    Uploaded
                  </dt>
                  <dd className="mt-1 text-sm text-[#5C4033] md:text-base">
                    {formatTimestamp(proof.uploadedAt)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold text-[#8B6A4E]">
                    Vaccination expiry
                  </dt>
                  <dd className="mt-1 text-sm text-[#5C4033] md:text-base">
                    {formatDisplayDate(proof.vaccinationExpiry)}
                  </dd>
                </div>

                {proof.checkedAt && (
                  <div>
                    <dt className="text-xs font-semibold text-[#8B6A4E]">
                      Checked
                    </dt>
                    <dd className="mt-1 text-sm text-[#5C4033] md:text-base">
                      {formatTimestamp(proof.checkedAt)}
                    </dd>
                  </div>
                )}
              </dl>
            )}

            <div className="flex flex-wrap justify-center gap-2 sm:justify-end">
              {proof && status !== "expired" && (
                <Button
                  type="button"
                  variant="light"
                  onClick={openProof}
                  disabled={opening || processing}
                  className="disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                >
                  {opening ? "Opening..." : "View Evidence"}
                </Button>
              )}

              {proof && status === "awaiting-review" && (
                <Button
                  type="button"
                  variant="dark"
                  onClick={() => requestAction("check")}
                  disabled={opening || processing}
                  className="disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                >
                  Mark as Checked
                </Button>
              )}

              {proof && status === "checked" && (
                <button
                  type="button"
                  onClick={() => requestAction("uncheck")}
                  disabled={opening || processing}
                  className="inline-flex min-h-11 w-fit items-center justify-center rounded-lg border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-700 transition-all duration-300 hover:scale-105 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 md:text-base"
                >
                  Mark as Awaiting Review
                </button>
              )}

              {proof && status !== "expired" && (
                <button
                  type="button"
                  onClick={() => requestAction("remove")}
                  disabled={opening || processing}
                  className="inline-flex min-h-11 w-fit items-center justify-center rounded-lg border border-red-400 px-4 py-2 text-sm font-semibold text-red-600 transition-all duration-300 hover:scale-105 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 md:text-base"
                >
                  Remove Evidence
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <ConfirmationModal
        isOpen={confirmationAction !== null}
        title={activeConfirmation?.title || "Vaccination Evidence"}
        confirmText={activeConfirmation?.confirmText || "Confirm"}
        cancelText="Go Back"
        isConfirming={processing}
        variant={activeConfirmation?.variant || "primary"}
        onConfirm={confirmAction}
        onCancel={() => {
          if (!processing) {
            setConfirmationAction(null);
          }
        }}
      >
        <div className="space-y-4">
          <p>{activeConfirmation?.description}</p>

          <dl className="rounded-xl border border-[#D9CBB8] bg-[#FFFDF9] p-4">
            <div>
              <dt className="text-xs font-semibold text-[#8B6A4E]">Dog</dt>
              <dd className="mt-1 text-lg font-semibold text-[#5C4033]">
                {dogName}
              </dd>
            </div>

            {proof?.originalFileName && (
              <div className="mt-3">
                <dt className="text-xs font-semibold text-[#8B6A4E]">
                  Evidence
                </dt>
                <dd className="mt-1 break-all text-[#5C4033]">
                  {proof.originalFileName}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </ConfirmationModal>
    </>
  );
}
