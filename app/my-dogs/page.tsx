"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/appActions";
import MessageBox from "@/components/MessageBox";
import LoadingScreen from "@/components/LoadingScreen";
import CustomerPageLayout from "@/components/CustomerPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import Link from "next/link";
import { authenticatedApiRequest } from "@/lib/client/authenticated-api";
import ConfirmationModal from "@/components/modals/ConfirmationModal";
import {
  getVaccinationProofPresentation,
  getVaccinationProofStatus,
  type VaccinationProofSummary,
} from "@/lib/vaccination-proof";

type Dog = {
  id: string;
  name: string;
  breed: string | null;
  date_of_birth: string | null;
  gender: string | null;
  neutered: boolean | null;
  vaccinated: boolean | null;
  vaccination_expiry: string | null;
  microchip_number: string | null;
  medical_notes: string | null;
  medication_notes: string | null;
  feeding_notes: string | null;
  behaviour_notes: string | null;
  meet_and_greet_completed: boolean | null;
};

type VaccinationProofRecord = VaccinationProofSummary;

type DeactivateDogResponse = {
  success: boolean;
  dogDeactivated: boolean;
  dog?: {
    id: string;
    ownerId: string;
    name: string;
    active: boolean;
  };
  message?: string;
  error?: string;
};

export default function MyDogsPage() {
  const [removingDogId, setRemovingDogId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [vaccinationProofByDogId, setVaccinationProofByDogId] = useState<
    Map<string, VaccinationProofRecord>
  >(new Map());
  const [message, setMessage] = useState("");

  const [isError, setIsError] = useState(false);
  const [dogToRemove, setDogToRemove] = useState<Dog | null>(null);

  useEffect(() => {
    loadDogs();
  }, []);

  async function loadDogs() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    let user;

    try {
      user = await getCurrentUser();
    } catch {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("dogs")
      .select(
        "id, name, breed, date_of_birth, gender, neutered, vaccinated, vaccination_expiry, microchip_number, medical_notes, medication_notes, feeding_notes, behaviour_notes, meet_and_greet_completed",
      )
      .eq("owner_id", user.id)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      setIsError(true);
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const loadedDogs = (data || []) as Dog[];
    const dogIds = loadedDogs.map((dog) => dog.id);

    let proofRecords: VaccinationProofRecord[] = [];

    if (dogIds.length > 0) {
      const { data: proofData, error: proofError } = await supabase
        .from("dog_vaccination_proofs")
        .select(
          `
      dog_id,
      storage_path,
      vaccination_expiry,
      checked_at,
      checked_by,
      deleted_at
      `,
        )
        .in("dog_id", dogIds);

      if (proofError) {
        setIsError(true);
        setMessage(proofError.message);
        setLoading(false);
        return;
      }

      proofRecords = (proofData || []) as VaccinationProofRecord[];
    }

    setDogs(loadedDogs);
    setVaccinationProofByDogId(
      new Map(proofRecords.map((proof) => [proof.dog_id, proof])),
    );
    setLoading(false);
  }

  function calculateAge(dateOfBirth: string | null) {
    if (!dateOfBirth) return "Age not provided";

    const today = new Date();
    const birthDate = new Date(dateOfBirth);

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();

    if (
      monthDifference < 0 ||
      (monthDifference === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    if (age <= 0) return "Under 1 year old";

    return `${age} ${age === 1 ? "year" : "years"} old`;
  }

  function basicInfoComplete(dog: Dog) {
    return Boolean(
      dog.name &&
      dog.breed &&
      dog.date_of_birth &&
      dog.gender &&
      dog.microchip_number,
    );
  }

  function careInfoComplete(dog: Dog) {
    return Boolean(
      dog.medical_notes ||
      dog.medication_notes ||
      dog.feeding_notes ||
      dog.behaviour_notes,
    );
  }

  if (loading) {
    return <LoadingScreen message="Loading your details..." />;
  }

  function requestDogRemoval(dog: Dog) {
    if (removingDogId) {
      return;
    }

    setMessage("");
    setIsError(false);
    setDogToRemove(dog);
  }

  async function confirmDogRemoval() {
    if (!dogToRemove || removingDogId) {
      return;
    }

    const dog = dogToRemove;

    setRemovingDogId(dog.id);
    setMessage("");
    setIsError(false);

    const result = await authenticatedApiRequest<DeactivateDogResponse>(
      `/api/dogs/${dog.id}`,
      {
        method: "DELETE",
      },
    );

    if (result.unauthenticated) {
      setRemovingDogId(null);
      setDogToRemove(null);
      window.location.href = "/login";
      return;
    }

    if (!result.ok) {
      setRemovingDogId(null);
      setDogToRemove(null);
      setIsError(true);
      setMessage(result.error || "The dog could not be removed.");
      return;
    }

    if (!result.data || !result.data.dogDeactivated) {
      setRemovingDogId(null);
      setDogToRemove(null);
      setIsError(true);
      setMessage(
        result.data?.error || "The dog service did not remove the dog.",
      );
      return;
    }

    await loadDogs();

    setRemovingDogId(null);
    setDogToRemove(null);
    setIsError(false);
    setMessage(
      result.data.message || "Your dog has been removed successfully.",
    );
  }

  return (
    <CustomerPageLayout>
      <PageCard
        className="mb-4 md:mb-8"
        title="My Dogs"
        subtitle="Manage your dogs and their information."
        actions={<Button href="/my-dogs/add">Add Dog</Button>}
      >
        {message && (
          <MessageBox type={isError ? "error" : "success"}>
            {message}
          </MessageBox>
        )}

        {dogs.length === 0 ? (
          <div className="text-center py-8 md:py-12">
            <p className="text-sm md:text-lg text-[#8B6A4E]">
              You haven't added any dogs yet.
            </p>

            <Link
              href="/my-dogs/add"
              className="inline-flex w-fit items-center justify-center mt-4 md:mt-6 bg-[#8B6A4E] text-white px-4 py-2 text-sm md:text-base md:px-6 md:py-3 rounded-lg font-semibold hover:bg-[#6F5440] hover:scale-105 transition"
            >
              Add your first Dog
            </Link>
          </div>
        ) : (
          <div className="mt-5 md:mt-8 space-y-4 md:space-y-6">
            {dogs.map((dog) => (
              <div
                key={dog.id}
                className="rounded-xl border border-[#D9CBB8] bg-white p-4 shadow-lg md:p-6"
              >
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 md:gap-4">
                  <div>
                    <h2 className="text-xl md:text-2xl font-semibold text-[#5C4033]">
                      {dog.name}
                    </h2>

                    <p className="mt-1 text-sm md:text-base text-[#8B6A4E]">
                      {dog.breed || "Breed not provided"} •{" "}
                      {calculateAge(dog.date_of_birth)}
                    </p>

                    <p className="mt-1 text-sm md:text-base text-[#8B6A4E]">
                      Vaccinated: {dog.vaccinated ? "Yes" : "No"}
                    </p>
                  </div>

                  <div className="text-left md:text-right">
                    {dog.meet_and_greet_completed ? (
                      <p className="text-sm md:text-base text-green-700 font-medium">
                        Meet & Greet Complete
                      </p>
                    ) : (
                      <p className="text-sm md:text-base text-amber-700 font-medium">
                        Meet & Greet Required
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 md:mt-4 space-y-1.5 md:space-y-2">
                  {basicInfoComplete(dog) ? (
                    <p className="text-sm md:text-base text-green-700 font-medium">
                      Basic Information Complete
                    </p>
                  ) : (
                    <p className="text-sm md:text-base text-red-700 font-medium">
                      Basic Information Incomplete
                    </p>
                  )}

                  {careInfoComplete(dog) ? (
                    <p className="text-sm md:text-base text-amber-700 font-medium">
                      Care & Behaviour Started
                    </p>
                  ) : (
                    <p className="text-sm md:text-base text-red-700 font-medium">
                      Care & Behaviour Incomplete
                    </p>
                  )}
                </div>

                {(() => {
                  const vaccinationProofPresentation =
                    getVaccinationProofPresentation(
                      getVaccinationProofStatus({
                        proof: vaccinationProofByDogId.get(dog.id),
                        dogVaccinationExpiry: dog.vaccination_expiry,
                      }),
                    );

                  return (
                    <p
                      className={`text-sm font-medium md:text-base ${vaccinationProofPresentation.className}`}
                    >
                      {vaccinationProofPresentation.label}
                    </p>
                  );
                })()}

                <div className="mt-4 md:mt-5 flex flex-wrap gap-3 md:gap-4">
                  <Link
                    href={`/my-dogs/edit/${dog.id}`}
                    className="inline-flex w-fit items-center justify-center bg-[#8B6A4E] text-white px-4 py-2 text-sm md:text-base rounded-lg font-semibold hover:bg-[#6F5440] hover:scale-105 transition-all duration-300 text-center"
                  >
                    Edit Dog
                  </Link>

                  <button
                    type="button"
                    onClick={() => requestDogRemoval(dog)}
                    disabled={removingDogId !== null}
                    className="inline-flex w-fit cursor-pointer items-center justify-center rounded-lg border border-red-400 px-4 py-2 text-sm font-semibold text-red-600 transition-all duration-300 hover:scale-105 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 md:text-base"
                  >
                    Remove Dog
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageCard>

      <ConfirmationModal
        isOpen={dogToRemove !== null}
        title="Remove Dog"
        confirmText="Remove Dog"
        cancelText="Keep Dog"
        isConfirming={removingDogId !== null}
        variant="danger"
        onConfirm={confirmDogRemoval}
        onCancel={() => {
          if (!removingDogId) {
            setDogToRemove(null);
          }
        }}
      >
        {dogToRemove && (
          <div className="space-y-4">
            <p>
              Please confirm that you want to remove this dog from your active
              dog profiles.
            </p>

            <dl className="grid gap-3 rounded-xl border border-[#D9CBB8] bg-[#FFFDF9] p-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-[#8B6A4E]">Dog</dt>
                <dd className="mt-1 text-lg font-semibold text-[#5C4033]">
                  {dogToRemove.name}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-[#8B6A4E]">Breed</dt>
                <dd className="mt-1 text-[#5C4033]">
                  {dogToRemove.breed || "Not provided"}
                </dd>
              </div>
            </dl>

            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-800">
              <p className="font-semibold">
                This dog will no longer appear under My Dogs.
              </p>

              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>The dog will become inactive.</li>
                <li>The dog cannot be selected for new bookings.</li>
                <li>
                  Historical dog and booking information will be retained.
                </li>
              </ul>
            </div>
          </div>
        )}
      </ConfirmationModal>
    </CustomerPageLayout>
  );
}
