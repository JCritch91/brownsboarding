import { NextResponse } from "next/server";

import {
  authenticateVaccinationProofRequest,
  buildVaccinationProofStoragePath,
  getCurrentDatabaseDate,
  getVaccinationProofStatus,
  isAllowedVaccinationProofMimeType,
  sanitiseOriginalFileName,
  supabaseAdmin,
  VACCINATION_PROOF_BUCKET,
  VACCINATION_PROOF_MAX_FILE_SIZE,
  VACCINATION_PROOF_SIGNED_URL_EXPIRY_SECONDS,
  type VaccinationProofRecord,
} from "@/lib/server/vaccination-proof";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    dogId: string;
  }>;
};

type DogRecord = {
  id: string;
  owner_id: string;
  name: string;
  active: boolean;
  vaccinated: boolean | null;
  vaccination_expiry: string | null;
};

function getFileSignature(bytes: Uint8Array) {
  return Array.from(bytes.slice(0, 12));
}

function fileContentMatchesMimeType(fileBytes: Uint8Array, mimeType: string) {
  const signature = getFileSignature(fileBytes);

  switch (mimeType) {
    case "application/pdf":
      return (
        signature[0] === 0x25 &&
        signature[1] === 0x50 &&
        signature[2] === 0x44 &&
        signature[3] === 0x46 &&
        signature[4] === 0x2d
      );

    case "image/jpeg":
      return (
        signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff
      );

    case "image/png":
      return (
        signature[0] === 0x89 &&
        signature[1] === 0x50 &&
        signature[2] === 0x4e &&
        signature[3] === 0x47 &&
        signature[4] === 0x0d &&
        signature[5] === 0x0a &&
        signature[6] === 0x1a &&
        signature[7] === 0x0a
      );

    case "image/webp":
      return (
        signature[0] === 0x52 &&
        signature[1] === 0x49 &&
        signature[2] === 0x46 &&
        signature[3] === 0x46 &&
        signature[8] === 0x57 &&
        signature[9] === 0x45 &&
        signature[10] === 0x42 &&
        signature[11] === 0x50
      );

    default:
      return false;
  }
}

async function loadOwnedDog(dogId: string, ownerId: string) {
  const { data: dog, error: dogError } = await supabaseAdmin
    .from("dogs")
    .select(
      `
      id,
      owner_id,
      name,
      active,
      vaccinated,
      vaccination_expiry
      `,
    )
    .eq("id", dogId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  return {
    dog: (dog as DogRecord | null) ?? null,
    error: dogError,
  };
}

async function loadVaccinationProof(dogId: string) {
  const { data: proof, error: proofError } = await supabaseAdmin
    .from("dog_vaccination_proofs")
    .select(
      `
      id,
      dog_id,
      storage_path,
      original_file_name,
      mime_type,
      file_size_bytes,
      vaccination_expiry,
      uploaded_at,
      checked_at,
      checked_by,
      deleted_at,
      deletion_reason,
      created_at,
      updated_at
      `,
    )
    .eq("dog_id", dogId)
    .maybeSingle();

  return {
    proof: (proof as VaccinationProofRecord | null) ?? null,
    error: proofError,
  };
}

export async function GET(request: Request, context: RouteContext) {
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

    const authentication = await authenticateVaccinationProofRequest(request);

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

    const { dog, error: dogError } = await loadOwnedDog(
      dogId,
      authentication.user.id,
    );

    if (dogError) {
      return NextResponse.json(
        {
          error: dogError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!dog) {
      return NextResponse.json(
        {
          error: "The dog could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    const { proof, error: proofError } = await loadVaccinationProof(dog.id);

    if (proofError) {
      return NextResponse.json(
        {
          error: proofError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!proof?.storage_path || proof.deleted_at) {
      return NextResponse.json(
        {
          error: "Vaccination evidence has not been uploaded for this dog.",
        },
        {
          status: 404,
        },
      );
    }

    if (proof.vaccination_expiry < getCurrentDatabaseDate()) {
      return NextResponse.json(
        {
          error:
            "This vaccination evidence has expired and can no longer be viewed.",
        },
        {
          status: 410,
        },
      );
    }

    const { data: signedUrlData, error: signedUrlError } =
      await supabaseAdmin.storage
        .from(VACCINATION_PROOF_BUCKET)
        .createSignedUrl(
          proof.storage_path,
          VACCINATION_PROOF_SIGNED_URL_EXPIRY_SECONDS,
        );

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return NextResponse.json(
        {
          error:
            signedUrlError?.message ||
            "A temporary vaccination evidence link could not be created.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,
      proofAvailable: true,
      proof: {
        id: proof.id,
        dogId: proof.dog_id,
        originalFileName: proof.original_file_name,
        mimeType: proof.mime_type,
        fileSizeBytes: proof.file_size_bytes,
        vaccinationExpiry: proof.vaccination_expiry,
        uploadedAt: proof.uploaded_at,
        checkedAt: proof.checked_at,
        status: getVaccinationProofStatus(proof),
      },
      signedUrl: signedUrlData.signedUrl,
      expiresInSeconds: VACCINATION_PROOF_SIGNED_URL_EXPIRY_SECONDS,
    });
  } catch (error) {
    console.error("Vaccination proof viewing failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to view vaccination evidence.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  let uploadedStoragePath: string | null = null;

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

    const authentication = await authenticateVaccinationProofRequest(request);

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

    const { dog, error: dogError } = await loadOwnedDog(
      dogId,
      authentication.user.id,
    );

    if (dogError) {
      return NextResponse.json(
        {
          error: dogError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!dog) {
      return NextResponse.json(
        {
          error: "The dog could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    if (!dog.active) {
      return NextResponse.json(
        {
          error: "Vaccination evidence cannot be uploaded for an inactive dog.",
        },
        {
          status: 409,
        },
      );
    }

    if (!dog.vaccinated) {
      return NextResponse.json(
        {
          error:
            "Vaccination evidence cannot be uploaded until the dog is marked as vaccinated.",
        },
        {
          status: 409,
        },
      );
    }

    if (!dog.vaccination_expiry) {
      return NextResponse.json(
        {
          error:
            "Please add the vaccination expiry date before uploading evidence.",
        },
        {
          status: 409,
        },
      );
    }

    if (dog.vaccination_expiry < getCurrentDatabaseDate()) {
      return NextResponse.json(
        {
          error:
            "The vaccination expiry date has passed. Please update it before uploading evidence.",
        },
        {
          status: 409,
        },
      );
    }

    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        {
          error: "The vaccination evidence upload is invalid.",
        },
        {
          status: 400,
        },
      );
    }

    const uploadedFile = formData.get("file");

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json(
        {
          error: "Please select a vaccination evidence file.",
        },
        {
          status: 400,
        },
      );
    }

    if (uploadedFile.size <= 0) {
      return NextResponse.json(
        {
          error: "The selected vaccination evidence file is empty.",
        },
        {
          status: 400,
        },
      );
    }

    if (uploadedFile.size > VACCINATION_PROOF_MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "Vaccination evidence must not exceed 5 MB.",
        },
        {
          status: 413,
        },
      );
    }

    if (!isAllowedVaccinationProofMimeType(uploadedFile.type)) {
      return NextResponse.json(
        {
          error: "Vaccination evidence must be a PDF, JPEG, PNG or WebP file.",
        },
        {
          status: 415,
        },
      );
    }

    const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());

    if (fileBuffer.length !== uploadedFile.size) {
      return NextResponse.json(
        {
          error: "The vaccination evidence file could not be read completely.",
        },
        {
          status: 400,
        },
      );
    }

    if (!fileContentMatchesMimeType(fileBuffer, uploadedFile.type)) {
      return NextResponse.json(
        {
          error:
            "The file content does not match the selected vaccination evidence type.",
        },
        {
          status: 415,
        },
      );
    }

    const { proof: existingProof, error: existingProofError } =
      await loadVaccinationProof(dog.id);

    if (existingProofError) {
      return NextResponse.json(
        {
          error: existingProofError.message,
        },
        {
          status: 500,
        },
      );
    }

    const proofId = existingProof?.id || crypto.randomUUID();

    const newStoragePath = buildVaccinationProofStoragePath({
      ownerId: authentication.user.id,
      dogId: dog.id,
      proofId: `${proofId}-${crypto.randomUUID()}`,
      mimeType: uploadedFile.type,
    });

    const { error: uploadError } = await supabaseAdmin.storage
      .from(VACCINATION_PROOF_BUCKET)
      .upload(newStoragePath, fileBuffer, {
        contentType: uploadedFile.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        {
          error:
            uploadError.message ||
            "The vaccination evidence file could not be uploaded.",
        },
        {
          status: 500,
        },
      );
    }

    uploadedStoragePath = newStoragePath;

    const uploadedAt = new Date().toISOString();

    const proofValues = {
      id: proofId,
      dog_id: dog.id,
      storage_path: newStoragePath,
      original_file_name: sanitiseOriginalFileName(uploadedFile.name),
      mime_type: uploadedFile.type,
      file_size_bytes: uploadedFile.size,
      vaccination_expiry: dog.vaccination_expiry,
      uploaded_at: uploadedAt,
      checked_at: null,
      checked_by: null,
      deleted_at: null,
      deletion_reason: null,
      updated_at: uploadedAt,
    };

    const { data: savedProof, error: saveProofError } = await supabaseAdmin
      .from("dog_vaccination_proofs")
      .upsert(proofValues, {
        onConflict: "dog_id",
      })
      .select(
        `
        id,
        dog_id,
        storage_path,
        original_file_name,
        mime_type,
        file_size_bytes,
        vaccination_expiry,
        uploaded_at,
        checked_at,
        checked_by,
        deleted_at,
        deletion_reason,
        created_at,
        updated_at
        `,
      )
      .single();

    if (saveProofError || !savedProof) {
      const { error: rollbackError } = await supabaseAdmin.storage
        .from(VACCINATION_PROOF_BUCKET)
        .remove([newStoragePath]);

      if (rollbackError) {
        console.error(
          `Vaccination proof upload rollback failed for dog ${dog.id}:`,
          rollbackError,
        );
      }

      uploadedStoragePath = null;

      return NextResponse.json(
        {
          error:
            saveProofError?.message ||
            "The vaccination evidence record could not be saved.",
        },
        {
          status: 500,
        },
      );
    }

    uploadedStoragePath = null;

    let previousFileDeleted = true;
    let previousFileDeletionError: string | null = null;

    if (
      existingProof?.storage_path &&
      existingProof.storage_path !== newStoragePath
    ) {
      const { error: previousFileError } = await supabaseAdmin.storage
        .from(VACCINATION_PROOF_BUCKET)
        .remove([existingProof.storage_path]);

      if (previousFileError) {
        previousFileDeleted = false;
        previousFileDeletionError = previousFileError.message;

        console.error(
          `Previous vaccination proof deletion failed for dog ${dog.id}:`,
          previousFileError,
        );
      }
    }

    const savedProofRecord = savedProof as VaccinationProofRecord;
    const followUpRequired = !previousFileDeleted;

    return NextResponse.json(
      {
        success: true,
        proofUploaded: true,
        followUpRequired,
        proof: {
          id: savedProofRecord.id,
          dogId: savedProofRecord.dog_id,
          originalFileName: savedProofRecord.original_file_name,
          mimeType: savedProofRecord.mime_type,
          fileSizeBytes: savedProofRecord.file_size_bytes,
          vaccinationExpiry: savedProofRecord.vaccination_expiry,
          uploadedAt: savedProofRecord.uploaded_at,
          checkedAt: savedProofRecord.checked_at,
          status: getVaccinationProofStatus(savedProofRecord),
        },
        previousFile: {
          deleted: previousFileDeleted,
          error: previousFileDeletionError,
        },
        message: followUpRequired
          ? "The new vaccination evidence was uploaded, but the previous file could not be removed automatically."
          : "Vaccination evidence uploaded successfully and is awaiting administrator review.",
      },
      {
        status: followUpRequired ? 207 : 200,
      },
    );
  } catch (error) {
    if (uploadedStoragePath) {
      const { error: cleanupError } = await supabaseAdmin.storage
        .from(VACCINATION_PROOF_BUCKET)
        .remove([uploadedStoragePath]);

      if (cleanupError) {
        console.error("Vaccination proof upload cleanup failed:", cleanupError);
      }
    }

    console.error("Vaccination proof upload failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to upload vaccination evidence.",
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

    const authentication = await authenticateVaccinationProofRequest(request);

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

    const { dog, error: dogError } = await loadOwnedDog(
      dogId,
      authentication.user.id,
    );

    if (dogError) {
      return NextResponse.json(
        {
          error: dogError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!dog) {
      return NextResponse.json(
        {
          error: "The dog could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    const { proof, error: proofError } = await loadVaccinationProof(dog.id);

    if (proofError) {
      return NextResponse.json(
        {
          error: proofError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!proof?.storage_path || proof.deleted_at) {
      return NextResponse.json({
        success: true,
        proofRemoved: true,
        alreadyRemoved: true,
        followUpRequired: false,
        message: "Vaccination evidence has already been removed.",
      });
    }

    const previousStoragePath = proof.storage_path;

    const { error: storageDeleteError } = await supabaseAdmin.storage
      .from(VACCINATION_PROOF_BUCKET)
      .remove([previousStoragePath]);

    if (storageDeleteError) {
      return NextResponse.json(
        {
          error:
            storageDeleteError.message ||
            "The vaccination evidence file could not be removed.",
        },
        {
          status: 500,
        },
      );
    }

    const deletionTimestamp = new Date().toISOString();

    const { data: removedProof, error: databaseUpdateError } =
      await supabaseAdmin
        .from("dog_vaccination_proofs")
        .update({
          storage_path: null,
          original_file_name: null,
          mime_type: null,
          file_size_bytes: null,
          uploaded_at: null,
          checked_at: null,
          checked_by: null,
          deleted_at: deletionTimestamp,
          deletion_reason: "Removed by customer",
          updated_at: deletionTimestamp,
        })
        .eq("id", proof.id)
        .eq("dog_id", dog.id)
        .select(
          `
          id,
          dog_id,
          storage_path,
          original_file_name,
          mime_type,
          file_size_bytes,
          vaccination_expiry,
          uploaded_at,
          checked_at,
          checked_by,
          deleted_at,
          deletion_reason,
          created_at,
          updated_at
          `,
        )
        .maybeSingle();

    if (databaseUpdateError || !removedProof) {
      console.error(
        `Vaccination proof metadata cleanup failed for dog ${dog.id}:`,
        databaseUpdateError,
      );

      return NextResponse.json(
        {
          success: true,
          proofRemoved: true,
          followUpRequired: true,
          error:
            databaseUpdateError?.message ||
            "The file was removed, but its database record could not be updated.",
          message:
            "The vaccination evidence file was removed, but Browns Boarding should review its database record.",
        },
        {
          status: 207,
        },
      );
    }

    return NextResponse.json({
      success: true,
      proofRemoved: true,
      alreadyRemoved: false,
      followUpRequired: false,
      proof: {
        id: removedProof.id,
        dogId: removedProof.dog_id,
        vaccinationExpiry: removedProof.vaccination_expiry,
        deletedAt: removedProof.deleted_at,
        deletionReason: removedProof.deletion_reason,
        status: "due",
      },
      message: "Vaccination evidence removed successfully.",
    });
  } catch (error) {
    console.error("Vaccination proof removal failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to remove vaccination evidence.",
      },
      {
        status: 500,
      },
    );
  }
}
