"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";
import { ensureActiveAdminUser } from "@/lib/appActions";
import { formatName } from "@/lib/helpers";

import AdminPageLayout from "@/components/AdminPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import MessageBox from "@/components/MessageBox";
import LoadingScreen from "@/components/LoadingScreen";

type CustomerProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  postcode: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  vet_name: string | null;
  vet_phone: string | null;
  vet_address: string | null;
  meet_and_greet_approved: boolean | null;
  active: boolean;
  was_activated: boolean;
  activated_at: string | null;
  created_at: string | null;
};

type CustomerSummary = CustomerProfile & {
  dogCount: number;
  upcomingBookingCount: number;
};

type CustomerFilter = "All" | "Active" | "Inactive" | "Not Activated";

export default function AdminCustomersPage() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] =
    useState<CustomerFilter>("All");

  useEffect(() => {
    checkAdminAndLoadCustomers();
  }, []);

  async function checkAdminAndLoadCustomers() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    const { redirectTo } = await ensureActiveAdminUser();

    if (redirectTo) {
      window.location.href = redirectTo;
      return;
    }

    await loadCustomers();
  }

  async function loadCustomers() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select(
        `
        id,
        first_name,
        last_name,
        email,
        phone,
        address_line_1,
        address_line_2,
        town,
        postcode,
        emergency_contact_name,
        emergency_contact_phone,
        vet_name,
        vet_phone,
        vet_address,
        meet_and_greet_approved,
        active,
        was_activated,
        activated_at,
        created_at
        `
      )
      .eq("is_admin", false)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    if (profileError) {
      setIsError(true);
      setMessage(profileError.message);
      setLoading(false);
      return;
    }

    const profiles = (profileData || []) as CustomerProfile[];

    if (profiles.length === 0) {
      setCustomers([]);
      setLoading(false);
      return;
    }

    const customerIds = profiles.map((profile) => profile.id);

    const today = new Date().toISOString().split("T")[0];

    const [
      { data: dogsData, error: dogsError },
      { data: bookingsData, error: bookingsError },
    ] = await Promise.all([
      supabase
        .from("dogs")
        .select("id, owner_id")
        .in("owner_id", customerIds)
        .eq("active", true),

      supabase
        .from("bookings")
        .select("id, owner_id, end_date, status")
        .in("owner_id", customerIds)
        .gte("end_date", today)
        .in("status", [
          "Pending",
          "Deposit Pending",
          "Balance Pending",
          "Balance Paid",
        ]),
    ]);

    if (dogsError) {
      setIsError(true);
      setMessage(dogsError.message);
      setLoading(false);
      return;
    }

    if (bookingsError) {
      setIsError(true);
      setMessage(bookingsError.message);
      setLoading(false);
      return;
    }

    const customerSummaries = profiles.map((profile) => {
      const dogCount = (dogsData || []).filter(
        (dog) => dog.owner_id === profile.id
      ).length;

      const upcomingBookingCount = (bookingsData || []).filter(
        (booking) => booking.owner_id === profile.id
      ).length;

      return {
        ...profile,
        dogCount,
        upcomingBookingCount,
      };
    });

    setCustomers(customerSummaries);
    setLoading(false);
  }

  function getCustomerName(customer: CustomerProfile) {
    const firstName = formatName(customer.first_name || "");
    const lastName = formatName(customer.last_name || "");

    const fullName = `${firstName} ${lastName}`.trim();

    return fullName || customer.email || "Customer";
  }

  function getCustomerAddress(customer: CustomerProfile) {
    return [
      customer.address_line_1,
      customer.address_line_2,
      customer.town,
      customer.postcode,
    ]
      .filter(Boolean)
      .join(", ");
  }

  function matchesSelectedFilter(customer: CustomerSummary) {
    switch (selectedFilter) {
      case "Active":
        return customer.active && customer.was_activated;

      case "Inactive":
        return !customer.active && customer.was_activated;

      case "Not Activated":
        return !customer.was_activated;

      default:
        return true;
    }
  }

  function matchesSearchTerm(customer: CustomerSummary) {
    const searchValue = searchTerm.trim().toLowerCase();

    if (!searchValue) {
      return true;
    }

    const searchableValues = [
      customer.first_name,
      customer.last_name,
      customer.email,
      customer.phone,
      customer.address_line_1,
      customer.address_line_2,
      customer.town,
      customer.postcode,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableValues.includes(searchValue);
  }

  const filteredCustomers = useMemo(() => {
    return customers.filter(
      (customer) =>
        matchesSelectedFilter(customer) &&
        matchesSearchTerm(customer)
    );
  }, [customers, searchTerm, selectedFilter]);

  const activeCustomers = customers.filter(
    (customer) => customer.active && customer.was_activated
  );

  const inactiveCustomers = customers.filter(
    (customer) => !customer.active && customer.was_activated
  );

  const unactivatedCustomers = customers.filter(
    (customer) => !customer.was_activated
  );

  if (loading) {
    return <LoadingScreen message="Loading customers..." />;
  }

  return (
    <AdminPageLayout>
        <PageCard
        title="Customers"
        subtitle="Create, view and manage customers, dogs and bookings."
        actions={
            <Button href="/admin/customers/add">
                Add Customer
            </Button>
        }
        >
        <div className="space-y-6 md:space-y-8">
          {message && (
            <MessageBox type={isError ? "error" : "success"}>
              {message}
            </MessageBox>
          )}

          <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <button
              type="button"
              onClick={() => setSelectedFilter("All")}
              className={`rounded-lg border p-3 text-left transition-all duration-200 md:p-4 ${
                selectedFilter === "All"
                  ? "border-[#8B6A4E] bg-[#F5EFE6] ring-2 ring-[#8B6A4E]/20"
                  : "border-[#D9CBB8] bg-white hover:bg-[#FFFDF9]"
              }`}
            >
              <p className="text-xs font-medium text-[#8B6A4E] md:text-sm">
                Total Customers
              </p>

              <p className="mt-1 text-xl font-bold text-[#5C4033] md:text-2xl">
                {customers.length}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFilter("Active")}
              className={`rounded-lg border p-3 text-left transition-all duration-200 md:p-4 ${
                selectedFilter === "Active"
                  ? "border-green-400 bg-green-50 ring-2 ring-green-200"
                  : "border-green-200 bg-green-50/50 hover:bg-green-50"
              }`}
            >
              <p className="text-xs font-medium text-green-700 md:text-sm">
                Active
              </p>

              <p className="mt-1 text-xl font-bold text-green-800 md:text-2xl">
                {activeCustomers.length}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFilter("Inactive")}
              className={`rounded-lg border p-3 text-left transition-all duration-200 md:p-4 ${
                selectedFilter === "Inactive"
                  ? "border-red-400 bg-red-50 ring-2 ring-red-200"
                  : "border-red-200 bg-red-50/50 hover:bg-red-50"
              }`}
            >
              <p className="text-xs font-medium text-red-700 md:text-sm">
                Inactive
              </p>

              <p className="mt-1 text-xl font-bold text-red-800 md:text-2xl">
                {inactiveCustomers.length}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFilter("Not Activated")}
              className={`rounded-lg border p-3 text-left transition-all duration-200 md:p-4 ${
                selectedFilter === "Not Activated"
                  ? "border-amber-400 bg-amber-50 ring-2 ring-amber-200"
                  : "border-amber-200 bg-amber-50/50 hover:bg-amber-50"
              }`}
            >
              <p className="text-xs font-medium text-amber-700 md:text-sm">
                Not Activated
              </p>

              <p className="mt-1 text-xl font-bold text-amber-800 md:text-2xl">
                {unactivatedCustomers.length}
              </p>
            </button>
          </section>

          <section>
            <label
              htmlFor="customerSearch"
              className="mb-2 block text-sm font-medium text-[#5C4033] md:text-base"
            >
              Search customers
            </label>

            <input
              id="customerSearch"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, email, phone or postcode..."
              className="min-h-11 w-full rounded-lg border border-[#D9CBB8] bg-white px-3 py-2 text-sm text-[#5C4033] placeholder:text-[#B89C82] outline-none focus:border-[#8B6A4E] focus:ring-2 focus:ring-[#8B6A4E]/20 md:text-base"
            />
          </section>

          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 md:mb-6">
              <h2 className="text-xl font-semibold text-[#5C4033] md:text-2xl">
                {selectedFilter === "All"
                  ? "All Customers"
                  : `${selectedFilter} Customers`}
              </h2>

              <p className="text-xs font-medium text-[#8B6A4E] md:text-sm">
                Showing {filteredCustomers.length} of {customers.length}
              </p>
            </div>

            {filteredCustomers.length === 0 ? (
              <div className="rounded-xl border border-[#D9CBB8] bg-[#FFFDF9] px-4 py-8 text-center md:px-6 md:py-12">
                <p className="text-sm text-[#8B6A4E] md:text-base">
                  No customers match the selected filters.
                </p>

                {(searchTerm || selectedFilter !== "All") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedFilter("All");
                    }}
                    className="mt-4 min-h-11 rounded-lg border border-[#D9CBB8] bg-white px-4 py-2 text-sm font-semibold text-[#8B6A4E] transition-all duration-200 hover:bg-[#F5EFE6]"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2 md:gap-6">
                {filteredCustomers.map((customer) => {
                  const customerName = getCustomerName(customer);
                  const customerAddress = getCustomerAddress(customer);

                  return (
                    <article
                      key={customer.id}
                      className="rounded-xl border border-[#D9CBB8] bg-white p-4 shadow-sm md:p-6"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="text-xl font-semibold text-[#5C4033] md:text-2xl">
                            {customerName}
                          </h3>

                          {customer.email && (
                            <p className="mt-1 break-all text-sm text-[#8B6A4E] md:text-base">
                              {customer.email}
                            </p>
                          )}

                          {customer.phone && (
                            <p className="mt-1 text-sm text-[#8B6A4E] md:text-base">
                              {customer.phone}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 sm:justify-end">
                        {!customer.was_activated ? (
                            <span className="inline-flex w-fit items-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 md:text-sm">
                            Not Activated
                            </span>
                        ) : customer.active ? (
                            <span className="inline-flex w-fit items-center rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800 md:text-sm">
                            Active
                            </span>
                        ) : (
                            <span className="inline-flex w-fit items-center rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 md:text-sm">
                            Inactive
                            </span>
                        )}

                        {customer.meet_and_greet_approved ? (
                            <span className="inline-flex w-fit items-center rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 md:text-sm">
                            Meet & Greet Approved
                            </span>
                        ) : (
                            <span className="inline-flex w-fit items-center rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 md:text-sm">
                            Meet & Greet Pending
                            </span>
                        )}
                        </div>
                        </div>

                        {customerAddress && (
                        <div className="mt-4 rounded-lg border border-[#D9CBB8] bg-[#F5EFE6] p-3 md:p-4">
                            <p className="text-xs font-semibold text-[#5C4033] md:text-sm">
                            Address
                            </p>

                            <p className="mt-1 text-sm text-[#8B6A4E] md:text-base">
                            {customerAddress}
                            </p>
                        </div>
                        )}

                        <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-[#D9CBB8] bg-[#FFFDF9] p-3 text-center">
                            <p className="text-xl font-bold text-[#5C4033]">
                            {customer.dogCount}
                            </p>

                            <p className="mt-1 text-xs font-medium text-[#8B6A4E] md:text-sm">
                            Active Dog
                            {customer.dogCount === 1 ? "" : "s"}
                            </p>
                        </div>

                        <div className="rounded-lg border border-[#D9CBB8] bg-[#FFFDF9] p-3 text-center">
                            <p className="text-xl font-bold text-[#5C4033]">
                            {customer.upcomingBookingCount}
                            </p>

                            <p className="mt-1 text-xs font-medium text-[#8B6A4E] md:text-sm">
                            Upcoming Booking
                            {customer.upcomingBookingCount === 1 ? "" : "s"}
                            </p>
                        </div>
                        </div>

                        <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-end">
                        <Button href={`/admin/customers/${customer.id}`}>
                            View Customer
                        </Button>

                        <Button href={`/admin/customers/${customer.id}/bookings/add`}>
                            Create Booking
                        </Button>
                        </div>

                        </article>
                    );
                    })}
                    </div>
                    )}
                    </section>
                </div>
            </PageCard>
        </AdminPageLayout>
    );
}