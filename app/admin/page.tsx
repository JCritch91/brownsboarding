"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ensureActiveAdminUser } from "@/lib/appActions";

import AdminPageLayout from "@/components/AdminPageLayout";
import PageCard from "@/components/PageCard";
import DashboardCard from "@/components/DashboardCard";
import MessageBox from "@/components/MessageBox";
import LoadingScreen from "@/components/LoadingScreen";
import {
  getVaccinationProofStatus,
  type VaccinationProofSummary,
} from "@/lib/vaccination-proof";
import { ACTIVE_BOOKING_STATUSES } from "@/types/booking";

type AdminActionCounts = {
  pendingBookings: number;
  meetAndGreetRequired: number;
  vaccinationExpired: number;
  vaccinationExpiringSoon: number;
  vaccinationProofMissing: number;
  vaccinationProofExpired: number;
  vaccinationProofAwaitingReview: number;
};

type VaccinationProofRecord = VaccinationProofSummary;

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);

  const [counts, setCounts] = useState<AdminActionCounts>({
    pendingBookings: 0,
    meetAndGreetRequired: 0,
    vaccinationExpired: 0,
    vaccinationExpiringSoon: 0,
    vaccinationProofMissing: 0,
    vaccinationProofExpired: 0,
    vaccinationProofAwaitingReview: 0,
  });

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  async function checkAdminAndLoadData() {
    setLoading(true);

    const { redirectTo } = await ensureActiveAdminUser();

    if (redirectTo) {
      window.location.href = redirectTo;
      return;
    }

    await loadAdminCounts();

    setLoading(false);
  }

  async function loadAdminCounts() {
    const today = new Date().toISOString().split("T")[0];

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const thirtyDaysFromNowString = thirtyDaysFromNow
      .toISOString()
      .split("T")[0];

    const { data: activeBookings, error: activeBookingsError } = await supabase
      .from("bookings")
      .select("id, dog_id, status")
      .in("status", ACTIVE_BOOKING_STATUSES);

    if (activeBookingsError) {
      console.error("Unable to load active bookings:", activeBookingsError);

      setCounts({
        pendingBookings: 0,
        meetAndGreetRequired: 0,
        vaccinationExpired: 0,
        vaccinationExpiringSoon: 0,
        vaccinationProofMissing: 0,
        vaccinationProofExpired: 0,
        vaccinationProofAwaitingReview: 0,
      });

      return;
    }

    const pendingBookingsCount = (activeBookings || []).filter(
      (booking) => booking.status === "Pending",
    ).length;

    const activeDogIds = Array.from(
      new Set(
        (activeBookings || [])
          .map((booking) => booking.dog_id)
          .filter((dogId): dogId is string => Boolean(dogId)),
      ),
    );

    if (activeDogIds.length === 0) {
      setCounts({
        pendingBookings: pendingBookingsCount,
        meetAndGreetRequired: 0,
        vaccinationExpired: 0,
        vaccinationExpiringSoon: 0,
        vaccinationProofMissing: 0,
        vaccinationProofExpired: 0,
        vaccinationProofAwaitingReview: 0,
      });

      return;
    }

    const { data: activeDogs, error: activeDogsError } = await supabase
      .from("dogs")
      .select(
        `
      id,
      active,
      meet_and_greet_completed,
      vaccination_expiry
      `,
      )
      .in("id", activeDogIds)
      .eq("active", true);

    if (activeDogsError) {
      console.error(
        "Unable to load dogs with active bookings:",
        activeDogsError,
      );

      setCounts({
        pendingBookings: pendingBookingsCount,
        meetAndGreetRequired: 0,
        vaccinationExpired: 0,
        vaccinationExpiringSoon: 0,
        vaccinationProofMissing: 0,
        vaccinationProofExpired: 0,
        vaccinationProofAwaitingReview: 0,
      });

      return;
    }

    const loadedDogs = activeDogs || [];
    const loadedDogIds = loadedDogs.map((dog) => dog.id);

    const meetAndGreetRequiredCount = loadedDogs.filter(
      (dog) => !dog.meet_and_greet_completed,
    ).length;

    const vaccinationExpiredCount = loadedDogs.filter(
      (dog) =>
        Boolean(dog.vaccination_expiry) && dog.vaccination_expiry < today,
    ).length;

    const vaccinationExpiringSoonCount = loadedDogs.filter(
      (dog) =>
        Boolean(dog.vaccination_expiry) &&
        dog.vaccination_expiry >= today &&
        dog.vaccination_expiry <= thirtyDaysFromNowString,
    ).length;

    let vaccinationProofs: VaccinationProofRecord[] = [];

    if (loadedDogIds.length > 0) {
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
        .in("dog_id", loadedDogIds);

      if (proofError) {
        console.error("Unable to load vaccination proof counts:", proofError);
      } else {
        vaccinationProofs = proofData || [];
      }
    }

    const vaccinationProofByDogId = new Map(
      vaccinationProofs.map((proof) => [proof.dog_id, proof]),
    );

    let vaccinationProofMissingCount = 0;
    let vaccinationProofExpiredCount = 0;
    let vaccinationProofAwaitingReviewCount = 0;

    for (const dog of loadedDogs) {
      const proofStatus = getVaccinationProofStatus({
        proof: vaccinationProofByDogId.get(dog.id),
        dogVaccinationExpiry: dog.vaccination_expiry,
        today,
      });

      switch (proofStatus) {
        case "due":
          vaccinationProofMissingCount += 1;
          break;

        case "expired":
          vaccinationProofExpiredCount += 1;
          break;

        case "awaiting-review":
          vaccinationProofAwaitingReviewCount += 1;
          break;

        default:
          break;
      }
    }

    setCounts({
      pendingBookings: pendingBookingsCount,
      meetAndGreetRequired: meetAndGreetRequiredCount,
      vaccinationExpired: vaccinationExpiredCount,
      vaccinationExpiringSoon: vaccinationExpiringSoonCount,
      vaccinationProofMissing: vaccinationProofMissingCount,
      vaccinationProofExpired: vaccinationProofExpiredCount,
      vaccinationProofAwaitingReview: vaccinationProofAwaitingReviewCount,
    });
  }

  function getTotalActions() {
    return (
      counts.pendingBookings +
      counts.meetAndGreetRequired +
      counts.vaccinationExpired +
      counts.vaccinationExpiringSoon +
      counts.vaccinationProofMissing +
      counts.vaccinationProofExpired +
      counts.vaccinationProofAwaitingReview
    );
  }

  if (loading) {
    return <LoadingScreen message="Loading admin dashboard..." />;
  }

  return (
    <AdminPageLayout>
      <PageCard
        className="mb-4 md:mb-8"
        title="Admin Dashboard"
        subtitle="Manage Browns Boarding operations, bookings, payments and customer requirements."
      >
        <h2 className="text-2xl md:text-3xl font-bold text-[#5C4033]">
          Actions Required ({getTotalActions()})
        </h2>

        {getTotalActions() === 0 ? (
          <div className="mt-4 md:mt-6">
            <MessageBox type="success">
              Everything looks good. No admin actions are currently required.
            </MessageBox>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:mt-6 md:grid-cols-2 md:gap-4">
            {counts.pendingBookings > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 md:p-4">
                <p className="text-sm font-semibold text-amber-800 md:text-base">
                  Pending bookings: {counts.pendingBookings}
                </p>
              </div>
            )}

            {counts.meetAndGreetRequired > 0 && (
              <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 md:p-4">
                <p className="text-sm font-semibold text-blue-800 md:text-base">
                  Meet and greets required: {counts.meetAndGreetRequired}
                </p>
              </div>
            )}

            {counts.vaccinationExpired > 0 && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 md:p-4">
                <p className="text-sm font-semibold text-red-700 md:text-base">
                  Expired vaccinations: {counts.vaccinationExpired}
                </p>
              </div>
            )}

            {counts.vaccinationExpiringSoon > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 md:p-4">
                <p className="text-sm font-semibold text-amber-800 md:text-base">
                  Vaccinations expiring soon: {counts.vaccinationExpiringSoon}
                </p>
              </div>
            )}

            {counts.vaccinationProofMissing > 0 && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 md:p-4">
                <p className="text-sm font-semibold text-red-800 md:text-base">
                  Vaccination proofs missing: {counts.vaccinationProofMissing}
                </p>
              </div>
            )}

            {counts.vaccinationProofExpired > 0 && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 md:p-4">
                <p className="text-sm font-semibold text-red-800 md:text-base">
                  Vaccination proofs expired: {counts.vaccinationProofExpired}
                </p>
              </div>
            )}

            {counts.vaccinationProofAwaitingReview > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 md:p-4">
                <p className="text-sm font-semibold text-amber-800 md:text-base">
                  Vaccination proofs awaiting review:{" "}
                  {counts.vaccinationProofAwaitingReview}
                </p>
              </div>
            )}
          </div>
        )}
      </PageCard>

      {/* Admin Tiles */}
      <div className="grid gap-3 md:grid-cols-2 md:gap-6">
        <DashboardCard href="/admin/accounting" title="Accounting">
          View payment records, invoice numbers, deposits, balances and income.
        </DashboardCard>

        <DashboardCard
          href="/admin/amend-availability"
          title="Amend Availability"
        >
          Manage available boarding dates, spaces and unavailable days.
        </DashboardCard>

        <DashboardCard href="/admin/bookings" title="View Bookings">
          Review pending bookings, confirm requests, cancel bookings and view
          historic stays.
        </DashboardCard>

        <DashboardCard href="/admin/customers" title="Customers">
          View customer profiles, dogs, booking history and account status.
        </DashboardCard>
      </div>
    </AdminPageLayout>
  );
}
