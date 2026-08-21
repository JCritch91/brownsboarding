import { NextResponse } from "next/server";

import {
  authenticateVaccinationProofRequest,
  getCurrentDatabaseDate,
  getVaccinationProofStatus,
  supabaseAdmin,
  VACCINATION_PROOF_BUCKET,
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

type ReviewRequestBody = {
  checked?: unknown;
};

async function authenticateAdmin(request: Request) {
  const authentication = await authenticateVaccinationProofRequest(request);

  if (!authentication.user || !authentication.profile) {
    return {
      user: null,
      error: authentication.error,
      status: authentication.status,
    };
  }

  if (!authentication.profile.is_admin) {
    return {
      user: null,
      error: "You do not have permission to manage vaccination evidence.",
      status: 403,
    };
  }

  return {
    user: authentication.user,
    error: "",
    status: 200,
  };
}

async function loadDog(dogId: string) {
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

    const authentication = await authenticateAdmin(request);

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

    const { dog, error: dogError } = await loadDog(dogId);

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
      dog: {
        id: dog.id,
        ownerId: dog.owner_id,
        name: dog.name,
        active: dog.active,
        vaccinated: dog.vaccinated,
        vaccinationExpiry: dog.vaccination_expiry,
      },
      proof: {
        id: proof.id,
        dogId: proof.dog_id,
        originalFileName: proof.original_file_name,
        mimeType: proof.mime_type,
        fileSizeBytes: proof.file_size_bytes,
        vaccinationExpiry: proof.vaccination_expiry,
        uploadedAt: proof.uploaded_at,
        checkedAt: proof.checked_at,
        checkedBy: proof.checked_by,
        status: getVaccinationProofStatus(proof),
      },
      signedUrl: signedUrlData.signedUrl,
      expiresInSeconds: VACCINATION_PROOF_SIGNED_URL_EXPIRY_SECONDS,
    });
  } catch (error) {
    console.error("Administrator vaccination proof viewing failed:", error);

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

export async function PATCH(request: Request, context: RouteContext) {
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

    const authentication = await authenticateAdmin(request);

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

    let body: ReviewRequestBody;

    try {
      body = (await request.json()) as ReviewRequestBody;
    } catch {
      return NextResponse.json(
        {
          error: "The vaccination evidence review request is invalid.",
        },
        {
          status: 400,
        },
      );
    }

    if (typeof body.checked !== "boolean") {
      return NextResponse.json(
        {
          error: "The vaccination evidence review status is invalid.",
        },
        {
          status: 400,
        },
      );
    }

    const { dog, error: dogError } = await loadDog(dogId);

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
          error:
            "Vaccination evidence must be uploaded before it can be reviewed.",
        },
        {
          status: 409,
        },
      );
    }

    if (proof.vaccination_expiry < getCurrentDatabaseDate()) {
      return NextResponse.json(
        {
          error: "Expired vaccination evidence cannot be marked as checked.",
        },
        {
          status: 409,
        },
      );
    }

    if (!dog.vaccinated || !dog.vaccination_expiry) {
      return NextResponse.json(
        {
          error:
            "The dog's vaccination details are incomplete and cannot be approved.",
        },
        {
          status: 409,
        },
      );
    }

    if (dog.vaccination_expiry !== proof.vaccination_expiry) {
      return NextResponse.json(
        {
          error:
            "The uploaded evidence does not match the dog's current vaccination expiry date. Please upload updated evidence.",
        },
        {
          status: 409,
        },
      );
    }

    const checkedAt = body.checked ? new Date().toISOString() : null;

    const checkedBy = body.checked ? authentication.user.id : null;

    const { data: updatedProof, error: updateError } = await supabaseAdmin
      .from("dog_vaccination_proofs")
      .update({
        checked_at: checkedAt,
        checked_by: checkedBy,
        updated_at: new Date().toISOString(),
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

    if (updateError || !updatedProof) {
      return NextResponse.json(
        {
          error:
            updateError?.message ||
            "The vaccination evidence review status could not be updated.",
        },
        {
          status: 500,
        },
      );
    }

    const updatedProofRecord = updatedProof as VaccinationProofRecord;

    return NextResponse.json({
      success: true,
      proofReviewed: true,
      proof: {
        id: updatedProofRecord.id,
        dogId: updatedProofRecord.dog_id,
        originalFileName: updatedProofRecord.original_file_name,
        vaccinationExpiry: updatedProofRecord.vaccination_expiry,
        uploadedAt: updatedProofRecord.uploaded_at,
        checkedAt: updatedProofRecord.checked_at,
        checkedBy: updatedProofRecord.checked_by,
        status: getVaccinationProofStatus(updatedProofRecord),
      },
      message: body.checked
        ? "Vaccination evidence marked as checked."
        : "Vaccination evidence marked as awaiting review.",
    });
  } catch (error) {
    console.error("Administrator vaccination proof review failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update the vaccination evidence review status.",
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

    const authentication = await authenticateAdmin(request);

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

    const { dog, error: dogError } = await loadDog(dogId);

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

    const storagePath = proof.storage_path;

    const { error: storageDeleteError } = await supabaseAdmin.storage
      .from(VACCINATION_PROOF_BUCKET)
      .remove([storagePath]);

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

    const { data: removedProof, error: updateError } = await supabaseAdmin
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
        deletion_reason: "Removed by administrator",
        updated_at: deletionTimestamp,
      })
      .eq("id", proof.id)
      .eq("dog_id", dog.id)
      .select(
        `
          id,
          dog_id,
          vaccination_expiry,
          deleted_at,
          deletion_reason
          `,
      )
      .maybeSingle();

    if (updateError || !removedProof) {
      console.error(
        `Administrator vaccination proof metadata cleanup failed for dog ${dog.id}:`,
        updateError,
      );

      return NextResponse.json(
        {
          success: true,
          proofRemoved: true,
          followUpRequired: true,
          error:
            updateError?.message ||
            "The file was removed, but its database record could not be updated.",
          message:
            "The vaccination evidence file was removed, but its database record requires review.",
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
      message: "Vaccination evidence removed by administrator.",
    });
  } catch (error) {
    console.error("Administrator vaccination proof removal failed:", error);

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
