"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

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
  status: VaccinationProofStatus;
};

type VaccinationProofResponse = {
  success: boolean;
  proofAvailable?: boolean;
  proofUploaded?: boolean;
  proofRemoved?: boolean;
  alreadyRemoved?: boolean;
  followUpRequired?: boolean;
  proof?: VaccinationProof;
  signedUrl?: string;
  expiresInSeconds?: number;
  message?: string;
  error?: string;
};

type VaccinationProofPanelProps = {
  dogId: string;
  dogName: string;
  vaccinated: boolean;
  vaccinationExpiry: string;
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

function formatFileSize(fileSizeBytes: number | null) {
  if (!fileSizeBytes || fileSizeBytes <= 0) {
    return "Unknown size";
  }

  if (fileSizeBytes < 1024 * 1024) {
    return `${Math.ceil(fileSizeBytes / 1024)} KB`;
  }

  return `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedDate(uploadedAt: string | null) {
  if (!uploadedAt) {
    return "Not recorded";
  }

  return new Date(uploadedAt).toLocaleDateString("en-GB", {
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
        description: "Browns Boarding has checked this vaccination evidence.",
      };

    case "awaiting-review":
      return {
        label: "Awaiting Admin Review",
        className: "border-amber-300 bg-amber-50 text-amber-800",
        description:
          "Your vaccination evidence has been uploaded and is waiting to be checked by Browns Boarding.",
      };

    case "expired":
      return {
        label: "Vaccination Proof Expired",
        className: "border-red-300 bg-red-50 text-red-800",
        description:
          "This vaccination evidence has expired. Please update the vaccination details and upload current evidence.",
      };

    default:
      return {
        label: "Vaccination Proof Due",
        className: "border-red-300 bg-red-50 text-red-800",
        description:
          "Upload current vaccination evidence so Browns Boarding can review it.",
      };
  }
}

export default function VaccinationProofPanel({
  dogId,
  dogName,
  vaccinated,
  vaccinationExpiry,
}: VaccinationProofPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [proof, setProof] = useState<VaccinationProof | null>(null);
  const [status, setStatus] = useState<VaccinationProofStatus>("due");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    loadProof();
  }, [dogId]);

  async function loadProof() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    const result = await authenticatedApiRequest<VaccinationProofResponse>(
      `/api/dogs/${dogId}/vaccination-proof`,
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

  function selectFile() {
    if (uploading || removing) {
      return;
    }

    setMessage("");
    setIsError(false);
    fileInputRef.current?.click();
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    event.target.value = "";

    if (!selectedFile) {
      return;
    }

    setMessage("");
    setIsError(false);

    if (!ALLOWED_FILE_TYPES.includes(selectedFile.type)) {
      setIsError(true);
      setMessage("Vaccination evidence must be a PDF, JPEG, PNG or WebP file.");
      return;
    }

    if (selectedFile.size <= 0) {
      setIsError(true);
      setMessage("The selected vaccination evidence file is empty.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setIsError(true);
      setMessage("Vaccination evidence must not exceed 5 MB.");
      return;
    }

    if (!vaccinated) {
      setIsError(true);
      setMessage(
        "Save the dog as vaccinated before uploading vaccination evidence.",
      );
      return;
    }

    if (!vaccinationExpiry) {
      setIsError(true);
      setMessage(
        "Save the vaccination expiry date before uploading vaccination evidence.",
      );
      return;
    }

    const uploadData = new FormData();

    uploadData.append("file", selectedFile);

    setUploading(true);

    const result = await authenticatedApiRequest<VaccinationProofResponse>(
      `/api/dogs/${dogId}/vaccination-proof`,
      {
        method: "POST",
        body: uploadData,
      },
    );

    setUploading(false);

    if (result.unauthenticated) {
      window.location.href = "/login";
      return;
    }

    if (!result.ok || !result.data?.proofUploaded) {
      setIsError(true);
      setMessage(result.error || "Vaccination evidence could not be uploaded.");
      return;
    }

    if (result.data.proof) {
      setProof(result.data.proof);
      setStatus(result.data.proof.status);
    } else {
      await loadProof();
    }

    if (result.data.followUpRequired) {
      setIsError(true);
      setMessage(
        result.data.message ||
          "The new evidence was uploaded, but the previous file requires administrator cleanup.",
      );
      return;
    }

    setIsError(false);
    setMessage(
      result.data.message ||
        "Vaccination evidence uploaded successfully and is awaiting administrator review.",
    );
  }

  async function openProof() {
    if (!proof || opening) {
      return;
    }

    setOpening(true);
    setMessage("");
    setIsError(false);

    const result = await authenticatedApiRequest<VaccinationProofResponse>(
      `/api/dogs/${dogId}/vaccination-proof`,
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

  function requestRemoval() {
    if (!proof || removing || uploading) {
      return;
    }

    setMessage("");
    setIsError(false);
    setShowRemoveModal(true);
  }

  async function confirmRemoval() {
    if (!proof || removing) {
      return;
    }

    setRemoving(true);
    setMessage("");
    setIsError(false);

    const result = await authenticatedApiRequest<VaccinationProofResponse>(
      `/api/dogs/${dogId}/vaccination-proof`,
      {
        method: "DELETE",
      },
    );

    setRemoving(false);
    setShowRemoveModal(false);

    if (result.unauthenticated) {
      window.location.href = "/login";
      return;
    }

    if (!result.ok || !result.data?.proofRemoved) {
      setIsError(true);
      setMessage(result.error || "Vaccination evidence could not be removed.");
      return;
    }

    setProof(null);
    setStatus("due");

    if (result.data.followUpRequired) {
      setIsError(true);
      setMessage(
        result.data.message ||
          "The file was removed, but its database record requires administrator review.",
      );
      return;
    }

    setIsError(false);
    setMessage(
      result.data.message || "Vaccination evidence removed successfully.",
    );
  }

  const statusPresentation = getStatusPresentation(status);

  return (
    <>
      <section className="rounded-xl border border-[#D9CBB8] bg-white p-4 shadow-sm md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#5C4033] md:text-2xl">
              Vaccination Evidence
            </h2>

            <p className="mt-1 text-sm text-[#8B6A4E] md:text-base">
              Upload a current vaccination certificate or record for {dogName}.
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
              <dl className="grid gap-3 rounded-lg border border-[#D9CBB8] bg-[#FFFDF9] p-4 sm:grid-cols-2">
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
                    {formatUploadedDate(proof.uploadedAt)}
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
              </dl>
            )}

            {!vaccinated && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-800 md:p-4">
                <p className="text-sm font-medium md:text-base">
                  Mark the dog as vaccinated and save the dog profile before
                  uploading evidence.
                </p>
              </div>
            )}

            {vaccinated && !vaccinationExpiry && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-800 md:p-4">
                <p className="text-sm font-medium md:text-base">
                  Add and save the vaccination expiry date before uploading
                  evidence.
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              onChange={handleFileSelection}
              className="hidden"
            />

            <p className="text-xs text-[#8B6A4E] md:text-sm">
              Accepted formats: PDF, JPEG, PNG and WebP. Maximum file size: 5
              MB.
            </p>

            <div className="flex flex-wrap justify-center gap-2 sm:justify-end">
              {proof && status !== "expired" && (
                <Button
                  type="button"
                  variant="light"
                  onClick={openProof}
                  disabled={opening || uploading || removing}
                  className="disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                >
                  {opening ? "Opening..." : "View Evidence"}
                </Button>
              )}

              <Button
                type="button"
                variant="dark"
                onClick={selectFile}
                disabled={
                  uploading || removing || !vaccinated || !vaccinationExpiry
                }
                className="disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              >
                {uploading
                  ? "Uploading..."
                  : proof && status !== "expired"
                    ? "Replace Evidence"
                    : "Upload Evidence"}
              </Button>

              {proof && status !== "expired" && (
                <button
                  type="button"
                  onClick={requestRemoval}
                  disabled={uploading || removing}
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
        isOpen={showRemoveModal}
        title="Remove Vaccination Evidence"
        confirmText="Remove Evidence"
        cancelText="Keep Evidence"
        isConfirming={removing}
        variant="danger"
        onConfirm={confirmRemoval}
        onCancel={() => {
          if (!removing) {
            setShowRemoveModal(false);
          }
        }}
      >
        <div className="space-y-4">
          <p>
            Please confirm that you want to remove the vaccination evidence for{" "}
            {dogName}.
          </p>

          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-800">
            <p className="font-semibold">
              Vaccination proof will immediately become due.
            </p>

            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>The uploaded document will be permanently deleted.</li>
              <li>Any administrator approval will be removed.</li>
              <li>New evidence can be uploaded afterwards.</li>
            </ul>
          </div>
        </div>
      </ConfirmationModal>
    </>
  );
}
