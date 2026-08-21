import { NextResponse } from "next/server";

import {
  supabaseAdmin,
  VACCINATION_PROOF_BUCKET,
  type VaccinationProofRecord,
} from "@/lib/server/vaccination-proof";
import { getCurrentDatabaseDate } from "@/lib/vaccination-proof";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLEANUP_BATCH_SIZE = 100;

type CleanupFailure = {
  proofId: string;
  dogId: string;
  stage: "storage" | "database";
  error: string;
};

function isAuthorisedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorizationHeader = request.headers.get("authorization");

  if (!cronSecret) {
    return {
      authorised: false,
      configurationError: true,
    };
  }

  return {
    authorised: authorizationHeader === `Bearer ${cronSecret}`,
    configurationError: false,
  };
}

export async function GET(request: Request) {
  const authorization = isAuthorisedCronRequest(request);

  if (authorization.configurationError) {
    console.error(
      "Expired vaccination proof cleanup cannot run because CRON_SECRET is missing.",
    );

    return NextResponse.json(
      {
        error: "The vaccination proof cleanup job is not configured.",
      },
      {
        status: 500,
      },
    );
  }

  if (!authorization.authorised) {
    return NextResponse.json(
      {
        error: "Unauthorised.",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const today = getCurrentDatabaseDate();

    const { data: expiredProofData, error: expiredProofError } =
      await supabaseAdmin
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
        .lt("vaccination_expiry", today)
        .not("storage_path", "is", null)
        .is("deleted_at", null)
        .order("vaccination_expiry", {
          ascending: true,
        })
        .limit(CLEANUP_BATCH_SIZE);

    if (expiredProofError) {
      return NextResponse.json(
        {
          error: expiredProofError.message,
        },
        {
          status: 500,
        },
      );
    }

    const expiredProofs = (expiredProofData || []) as VaccinationProofRecord[];

    if (expiredProofs.length === 0) {
      return NextResponse.json({
        success: true,
        cleanupCompleted: true,
        processed: 0,
        deleted: 0,
        failed: 0,
        remainingBatchPossible: false,
        message: "No expired vaccination evidence required deletion.",
      });
    }

    const failures: CleanupFailure[] = [];
    let deletedCount = 0;

    for (const proof of expiredProofs) {
      if (!proof.storage_path) {
        continue;
      }

      const { error: storageDeleteError } = await supabaseAdmin.storage
        .from(VACCINATION_PROOF_BUCKET)
        .remove([proof.storage_path]);

      if (storageDeleteError) {
        failures.push({
          proofId: proof.id,
          dogId: proof.dog_id,
          stage: "storage",
          error: storageDeleteError.message,
        });

        console.error(
          `Expired vaccination proof Storage deletion failed for proof ${proof.id}:`,
          storageDeleteError,
        );

        continue;
      }

      const deletionTimestamp = new Date().toISOString();

      const { error: databaseUpdateError } = await supabaseAdmin
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
          deletion_reason: "Automatically deleted after vaccination expiry",
          updated_at: deletionTimestamp,
        })
        .eq("id", proof.id)
        .eq("dog_id", proof.dog_id)
        .eq("storage_path", proof.storage_path)
        .is("deleted_at", null);

      if (databaseUpdateError) {
        failures.push({
          proofId: proof.id,
          dogId: proof.dog_id,
          stage: "database",
          error: databaseUpdateError.message,
        });

        console.error(
          `Expired vaccination proof database cleanup failed for proof ${proof.id}:`,
          databaseUpdateError,
        );

        continue;
      }

      deletedCount += 1;
    }

    const followUpRequired = failures.length > 0;
    const remainingBatchPossible = expiredProofs.length === CLEANUP_BATCH_SIZE;

    return NextResponse.json(
      {
        success: true,
        cleanupCompleted: true,
        followUpRequired,
        processed: expiredProofs.length,
        deleted: deletedCount,
        failed: failures.length,
        remainingBatchPossible,
        failures,
        message: followUpRequired
          ? "Expired vaccination evidence cleanup completed with one or more failures."
          : "Expired vaccination evidence cleanup completed successfully.",
      },
      {
        status: followUpRequired ? 207 : 200,
      },
    );
  } catch (error) {
    console.error("Expired vaccination proof cleanup failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete expired vaccination evidence.",
      },
      {
        status: 500,
      },
    );
  }
}
