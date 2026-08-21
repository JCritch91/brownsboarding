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
import Button from "@/components/Buttons";
import ConfirmationModal from "@/components/modals/ConfirmationModal";
import { authenticatedApiRequest } from "@/lib/client/authenticated-api";

type PricingSettings = {
  id: string;
  nightly_rate: number;
  deposit_percentage: number;
  daycare_full_day_rate: number;
  daycare_half_day_rate: number;
  daycare_deposit_percentage: number;
  effective_from: string;
};

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
  const [pricing, setPricing] = useState<PricingSettings | null>(null);

  const [showPricingModal, setShowPricingModal] = useState(false);

  const [savingPricing, setSavingPricing] = useState(false);

  const [pricingForm, setPricingForm] = useState({
    boardingNightlyRate: "",
    boardingDepositPercentage: "",
    daycareFullDayRate: "",
    daycareHalfDayRate: "",
    daycareDepositPercentage: "",
    effectiveFrom: "",
  });

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
    await loadPricing();
    setLoading(false);
  }

  async function loadPricing() {
    const result = await authenticatedApiRequest<{
      success: boolean;
      pricing: PricingSettings;
    }>("/api/admin/pricing", {
      method: "GET",
    });

    if (!result.ok || !result.data?.pricing) {
      return;
    }

    setPricing(result.data.pricing);

    setPricingForm({
      boardingNightlyRate: result.data.pricing.nightly_rate.toString(),
      boardingDepositPercentage:
        result.data.pricing.deposit_percentage.toString(),
      daycareFullDayRate: result.data.pricing.daycare_full_day_rate.toString(),
      daycareHalfDayRate: result.data.pricing.daycare_half_day_rate.toString(),
      daycareDepositPercentage:
        result.data.pricing.daycare_deposit_percentage.toString(),
      effectiveFrom: result.data.pricing.effective_from,
    });
  }

  async function savePricing() {
    if (savingPricing) {
      return;
    }

    setSavingPricing(true);

    const result = await authenticatedApiRequest<{
      success: boolean;
      pricingCreated: boolean;
    }>("/api/admin/pricing", {
      method: "POST",
      body: {
        boardingNightlyRate: Number(pricingForm.boardingNightlyRate),
        boardingDepositPercentage: Number(
          pricingForm.boardingDepositPercentage,
        ),
        daycareFullDayRate: Number(pricingForm.daycareFullDayRate),
        daycareHalfDayRate: Number(pricingForm.daycareHalfDayRate),
        daycareDepositPercentage: Number(pricingForm.daycareDepositPercentage),
        effectiveFrom: pricingForm.effectiveFrom,
      },
    });

    setSavingPricing(false);

    if (!result.ok || !result.data?.pricingCreated) {
      return;
    }

    setShowPricingModal(false);

    await loadPricing();
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
      {pricing && (
        <PageCard className="mb-4 md:mb-6" title="Current Pricing">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-[#D9CBB8] bg-[#FFFDF9] p-4">
              <h3 className="text-lg font-semibold text-[#5C4033]">Boarding</h3>

              <p className="mt-2 text-2xl font-bold text-[#5C4033]">
                £{pricing.nightly_rate.toFixed(2)}
              </p>

              <p className="text-sm text-[#8B6A4E]">Per night</p>

              <p className="mt-3 text-sm font-medium text-[#5C4033]">
                Deposit: {pricing.deposit_percentage}%
              </p>
            </div>

            <div className="rounded-lg border border-[#D9CBB8] bg-[#FFFDF9] p-4">
              <h3 className="text-lg font-semibold text-[#5C4033]">
                Doggy Day Care
              </h3>

              <p className="mt-2 text-sm text-[#5C4033]">
                Full Day:
                <strong> £{pricing.daycare_full_day_rate.toFixed(2)}</strong>
              </p>

              <p className="mt-1 text-sm text-[#5C4033]">
                Half Day:
                <strong> £{pricing.daycare_half_day_rate.toFixed(2)}</strong>
              </p>

              <p className="mt-3 text-sm font-medium text-[#5C4033]">
                Deposit: {pricing.daycare_deposit_percentage}%
              </p>
            </div>

            <div className="md:col-span-2 flex flex-col gap-3 border-t border-[#D9CBB8] pt-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-[#8B6A4E]">
                Effective From: {pricing.effective_from}
              </p>

              <Button type="button" onClick={() => setShowPricingModal(true)}>
                Amend Pricing
              </Button>
            </div>
          </div>
        </PageCard>
      )}
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
      <ConfirmationModal
        isOpen={showPricingModal}
        title="Update Pricing"
        confirmText="Save Pricing"
        cancelText="Cancel"
        isConfirming={savingPricing}
        variant="primary"
        onConfirm={savePricing}
        onCancel={() => {
          if (!savingPricing) {
            setShowPricingModal(false);
          }
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-[#5C4033]">
              Boarding Nightly Rate (£)
            </label>

            <input
              type="number"
              step="0.01"
              value={pricingForm.boardingNightlyRate}
              onChange={(event) =>
                setPricingForm((current) => ({
                  ...current,
                  boardingNightlyRate: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-[#D9CBB8] px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#5C4033]">
              Boarding Deposit (%)
            </label>

            <input
              type="number"
              step="0.01"
              value={pricingForm.boardingDepositPercentage}
              onChange={(event) =>
                setPricingForm((current) => ({
                  ...current,
                  boardingDepositPercentage: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-[#D9CBB8] px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#5C4033]">
              Daycare Full Day (£)
            </label>

            <input
              type="number"
              step="0.01"
              value={pricingForm.daycareFullDayRate}
              onChange={(event) =>
                setPricingForm((current) => ({
                  ...current,
                  daycareFullDayRate: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-[#D9CBB8] px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#5C4033]">
              Daycare Half Day (£)
            </label>

            <input
              type="number"
              step="0.01"
              value={pricingForm.daycareHalfDayRate}
              onChange={(event) =>
                setPricingForm((current) => ({
                  ...current,
                  daycareHalfDayRate: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-[#D9CBB8] px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#5C4033]">
              Daycare Deposit (%)
            </label>

            <input
              type="number"
              step="0.01"
              value={pricingForm.daycareDepositPercentage}
              onChange={(event) =>
                setPricingForm((current) => ({
                  ...current,
                  daycareDepositPercentage: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-[#D9CBB8] px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#5C4033]">
              Effective From
            </label>

            <input
              type="date"
              value={pricingForm.effectiveFrom}
              onChange={(event) =>
                setPricingForm((current) => ({
                  ...current,
                  effectiveFrom: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-[#D9CBB8] px-3 py-2"
            />
          </div>
        </div>
      </ConfirmationModal>
    </AdminPageLayout>
  );
}
