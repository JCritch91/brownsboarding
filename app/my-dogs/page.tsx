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

export default function MyDogsPage() {
  const [loading, setLoading] = useState(true);
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadDogs();
  }, []);

  async function loadDogs() {
    setLoading(true);
    setMessage("");

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
        "id, name, breed, date_of_birth, gender, neutered, vaccinated, vaccination_expiry, microchip_number, medical_notes, medication_notes, feeding_notes, behaviour_notes, meet_and_greet_completed"
      )
      .eq("owner_id", user.id)
      .eq("active", true)
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setDogs(data || []);
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
        dog.microchip_number
    );
  }

  function careInfoComplete(dog: Dog) {
    return Boolean(
      dog.medical_notes ||
        dog.medication_notes ||
        dog.feeding_notes ||
        dog.behaviour_notes
    );
  }

if (loading) {
  return <LoadingScreen message="Loading your details..." />;
}

  async function removeDog(dogId: string) {

  const { data: bookings, error: bookingError } = await supabase
    .from("bookings")
    .select("id")
    .eq("dog_id", dogId)
    .in("status", ["Pending", "Confirmed"]);

  if (bookingError) {
    setMessage(bookingError.message);
    return;
  }

  if (bookings && bookings.length > 0) {
    setMessage(
      "This dog cannot be removed because there is a current or future booking associated with it."
    );
    return;
  }

  const confirmed = window.confirm(
    "Are you sure you want to remove this dog?\n\nThe dog will no longer appear in My Dogs, but historical information and bookings will be retained."
  );

  if (!confirmed) return;

  const { error } = await supabase
    .from("dogs")
    .update({
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dogId);

  if (error) {
    setMessage(error.message);
    return;
  }

  loadDogs();
}

  return (
    <CustomerPageLayout>
        <PageCard
        className="mb-4 md:mb-8"
        title="My Dogs"
        subtitle="Manage your dogs and their information."
        actions={
            <Button href="/my-dogs/add">
                Add Dog
            </Button>
        }
        >
            
        {message && (
            <MessageBox type="error">
              {message}
            </MessageBox>
        )}

          {dogs.length === 0 ? (
            <div className="text-center py-8 md:py-12">
                <p className="text-sm md:text-lg text-[#8B6A4E]">
                    You haven't added any dogs yet.
                </p>

                <Link href="/my-dogs/add" className="inline-flex w-fit items-center justify-center mt-4 md:mt-6 bg-[#8B6A4E] text-white px-4 py-2 text-sm md:text-base md:px-6 md:py-3 rounded-lg font-semibold hover:bg-[#6F5440] hover:scale-105 transition">
                Add your first Dog
                </Link>
            </div>
          ) : (
            <div className="mt-5 md:mt-8 space-y-4 md:space-y-6">
              {dogs.map((dog) => (
                <div
                  key={dog.id}
                    className="bg-[#FFFDF[#D9CBB89] p-4 md:p-6 rounded-xl border border-] shadow-lg"                >
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
                      <p className="text-sm md:text-base text-amber-700 font-medium">
                        Basic Information Incomplete
                      </p>
                    )}

                    {careInfoComplete(dog) ? (
                      <p className="text-sm md:text-base text-green-700 font-medium">
                        Care & Behaviour Started
                      </p>
                    ) : (
                      <p className="text-sm md:text-base text-amber-700 font-medium">
                        Care & Behaviour Incomplete
                      </p>
                    )}
                  </div>

                  <div className="mt-4 md:mt-5 flex flex-wrap gap-3 md:gap-4">
                    <Link href={`/my-dogs/edit/${dog.id}`}
                    className="inline-flex w-fit items-center justify-center bg-[#8B6A4E] text-white px-4 py-2 text-sm md:text-base rounded-lg font-semibold hover:bg-[#6F5440] hover:scale-105 transition-all duration-300 text-center">
                      Edit Dog
                    </Link>

                    <button
                      type="button"
                      onClick={() => removeDog(dog.id)}
                      className="inline-flex w-fit items-center justify-center border border-red-400 text-red-600 px-4 py-2 text-sm md:text-base rounded-lg font-semibold hover:bg-red-50 hover:scale-105 transition-all duration-300 text-center cursor-pointer"
                    >
                      Remove Dog
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PageCard>
    </CustomerPageLayout>
  );
}