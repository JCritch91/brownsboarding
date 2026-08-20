"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ensureActiveAdminUser } from "@/lib/appActions";

import AdminPageLayout from "@/components/AdminPageLayout";
import PageCard from "@/components/PageCard";
import DashboardCard from "@/components/DashboardCard";
import MessageBox from "@/components/MessageBox";
import LoadingScreen from "@/components/LoadingScreen";

type AdminActionCounts = {
  pendingBookings: number;
  meetAndGreetRequired: number;
  vaccinationExpired: number;
  vaccinationExpiringSoon: number;
};

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);

  const [counts, setCounts] = useState<AdminActionCounts>({
    pendingBookings: 0,
    meetAndGreetRequired: 0,
    vaccinationExpired: 0,
    vaccinationExpiringSoon: 0,
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

    const { count: pendingBookingsCount } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "Pending");

    const { count: meetAndGreetCount } = await supabase
      .from("dogs")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .eq("meet_and_greet_completed", false);

    const { count: vaccinationExpiredCount } = await supabase
      .from("dogs")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .lt("vaccination_expiry", today);

    const { count: vaccinationExpiringSoonCount } = await supabase
      .from("dogs")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .gte("vaccination_expiry", today)
      .lte("vaccination_expiry", thirtyDaysFromNowString);

    setCounts({
      pendingBookings: pendingBookingsCount || 0,
      meetAndGreetRequired: meetAndGreetCount || 0,
      vaccinationExpired: vaccinationExpiredCount || 0,
      vaccinationExpiringSoon: vaccinationExpiringSoonCount || 0,
    });
  }

  function getTotalActions() {
    return (
      counts.pendingBookings +
      counts.meetAndGreetRequired +
      counts.vaccinationExpired +
      counts.vaccinationExpiringSoon
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
          <div className="mt-4 md:mt-6 grid gap-3 md:grid-cols-2 md:gap-4">
            <div className="bg-amber-50 border border-amber-300 p-3 md:p-4 rounded-lg">
              <p className="text-sm md:text-base text-amber-800 font-semibold">
                Pending bookings: {counts.pendingBookings}
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-300 p-3 md:p-4 rounded-lg">
              <p className="text-sm md:text-base text-blue-800 font-semibold">
                Meet and greets required: {counts.meetAndGreetRequired}
              </p>
            </div>

            <div className="bg-red-50 border border-red-300 p-3 md:p-4 rounded-lg">
              <p className="text-sm md:text-base text-red-700 font-semibold">
                Expired vaccinations: {counts.vaccinationExpired}
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-300 p-3 md:p-4 rounded-lg">
              <p className="text-sm md:text-base text-amber-800 font-semibold">
                Vaccinations expiring soon: {counts.vaccinationExpiringSoon}
              </p>
            </div>
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
