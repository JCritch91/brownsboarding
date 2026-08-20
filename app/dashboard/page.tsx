"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/appActions";
import CustomerPageLayout from "@/components/CustomerPageLayout";
import PageCard from "@/components/PageCard";
import DashboardCard from "@/components/DashboardCard";
import Button from "@/components/Buttons";

type ActionItem = {
  id: string;
  type: "error" | "warning" | "info";
  group: string;
  message: string;
  link: string;
  linkText: string;
};
type Dog = {
  id: string;
  name: string;
  breed: string | null;
  date_of_birth: string | null;
  gender: string | null;
  microchip_number: string | null;
  vaccinated: boolean | null;
  vaccination_expiry: string | null;
  meet_and_greet_completed: boolean | null;
};

export default function DashboardPage() {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loadingActions, setLoadingActions] = useState(true);
  const [showMeetAndGreet, setShowMeetAndGreet] = useState(false);
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    checkAccount();
    loadActionItems();
  }, []);

  async function loadActionItems() {
    setLoadingActions(true);

    let user;

    try {
      user = await getCurrentUser();
    } catch {
      window.location.href = "/login";
      return;
    }

    const items: ActionItem[] = [];

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "address_line_1, town, postcode, emergency_contact_name, emergency_contact_phone",
      )
      .eq("id", user.id)
      .single();

    if (profile) {
      if (!profile.address_line_1 || !profile.town || !profile.postcode) {
        items.push({
          id: "profile-address",
          type: "warning",
          group: "Account Details",
          message: "Your address details are incomplete.",
          link: "/my-details",
          linkText: "Update Details",
        });
      }

      if (!profile.emergency_contact_name || !profile.emergency_contact_phone) {
        items.push({
          id: "profile-emergency-contact",
          type: "warning",
          group: "Account Details",
          message: "Emergency contact details are incomplete.",
          link: "/my-details",
          linkText: "Update Details",
        });
      }
    }

    const { data: dogs } = await supabase
      .from("dogs")
      .select(
        "id, name, breed, date_of_birth, gender, microchip_number, vaccinated, vaccination_expiry, meet_and_greet_completed",
      )
      .eq("owner_id", user.id)
      .eq("active", true);

    if (dogs) {
      const dogsNeedingMeetAndGreet = dogs.some(
        (dog: Dog) => !dog.meet_and_greet_completed,
      );

      setShowMeetAndGreet(dogsNeedingMeetAndGreet);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    thirtyDaysFromNow.setHours(0, 0, 0, 0);

    if (dogs) {
      dogs.forEach((dog: Dog) => {
        const dogName = dog.name || "One of your dogs";

        if (
          !dog.breed ||
          !dog.date_of_birth ||
          !dog.gender ||
          !dog.microchip_number
        ) {
          items.push({
            id: `dog-basic-${dog.id}`,
            type: "warning",
            group: dogName,
            message: "Dog profile is missing some basic information.",
            link: `/my-dogs/edit/${dog.id}`,
            linkText: "Update Dog",
          });
        }

        if (!dog.meet_and_greet_completed) {
          items.push({
            id: `dog-meet-greet-${dog.id}`,
            type: "info",
            group: dogName,
            message:
              "Meet and greet is still required before boarding is confirmed.",
            link: "/meet-and-greet",
            linkText: "Arrange Meet & Greet",
          });
        }

        if (!dog.vaccinated || !dog.vaccination_expiry) {
          items.push({
            id: `dog-vaccination-missing-${dog.id}`,
            type: "error",
            group: dogName,
            message: "Vaccination information is incomplete.",
            link: `/my-dogs/edit/${dog.id}`,
            linkText: "Update Dog",
          });

          return;
        }

        const vaccinationExpiry = new Date(dog.vaccination_expiry);
        vaccinationExpiry.setHours(0, 0, 0, 0);

        if (vaccinationExpiry < today) {
          items.push({
            id: `dog-vaccination-expired-${dog.id}`,
            type: "error",
            group: dogName,
            message: "Vaccination has expired.",
            link: `/my-dogs/edit/${dog.id}`,
            linkText: "Update Dog",
          });
        } else if (vaccinationExpiry <= thirtyDaysFromNow) {
          items.push({
            id: `dog-vaccination-expiring-${dog.id}`,
            type: "warning",
            group: dogName,
            message: "Vaccination expires soon.",
            link: `/my-dogs/edit/${dog.id}`,
            linkText: "Update Dog",
          });
        }
      });
    }

    setActionItems(items);
    setLoadingActions(false);
  }

  async function checkAccount() {
    let user;

    try {
      user = await getCurrentUser();
    } catch {
      window.location.href = "/login";
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("active")
      .eq("id", user.id)
      .single();

    if (profileError) {
      await supabase.auth.signOut();
      window.location.href = "/";
      return;
    }

    if (!profile.active) {
      await supabase.auth.signOut();
      window.location.href = "/";
      return;
    }
  }

  function getActionItemStyle(type: ActionItem["type"]) {
    if (type === "error") {
      return "bg-red-50 border-red-300 text-red-700";
    }

    if (type === "warning") {
      return "bg-amber-50 border-amber-300 text-amber-800";
    }

    return "bg-blue-50 border-blue-300 text-blue-800";
  }
  const groupedActionItems = actionItems.reduce<Record<string, ActionItem[]>>(
    (groups, item) => {
      if (!groups[item.group]) {
        groups[item.group] = [];
      }

      groups[item.group].push(item);

      return groups;
    },
    {},
  );

  const hasErrors = actionItems.some((item) => item.type === "error");
  const hasWarnings = actionItems.some((item) => item.type === "warning");

  const actionSummaryStyle = hasErrors
    ? "bg-red-50 border-red-300 text-red-800"
    : hasWarnings
      ? "bg-amber-50 border-amber-300 text-amber-800"
      : "bg-blue-50 border-blue-300 text-blue-800";

  return (
    <CustomerPageLayout>
      <PageCard
        className="mb-4 md:mb-8"
        title="Dashboard"
        subtitle="Welcome to Browns Boarding. Manage your dogs, bookings and account details here."
      >
        <h2 className="text-xl md:text-2xl font-bold text-[#5C4033] mb-4 md:mb-6">
          Account Status
        </h2>

        {loadingActions ? (
          <p className="mt-2 text-sm md:text-base text-[#8B6A4E]">
            Checking your account...
          </p>
        ) : actionItems.length === 0 ? (
          <div className="mt-4 md:mt-6 bg-green-50 border border-green-300 p-4 md:p-6 rounded-lg">
            <p className="text-sm md:text-base text-green-800 font-medium">
              Everything looks good. No actions are currently required.
            </p>
          </div>
        ) : (
          <div className="space-y-3 md:space-y-4">
            <div
              className={`border p-3 md:p-4 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 ${actionSummaryStyle}`}
            >
              <p className="text-sm md:text-base font-medium">
                {actionItems.length} action
                {actionItems.length === 1 ? "" : "s"} require your attention.
              </p>

              <Button
                type="button"
                onClick={() => setShowActions((current) => !current)}
                className="px-4 py-2"
              >
                {showActions ? "Hide Actions" : "View Actions"}
              </Button>
            </div>

            {showActions && (
              <div className="space-y-3 md:space-y-5">
                {Object.entries(groupedActionItems).map(([group, items]) => (
                  <div
                    key={group}
                    className="border border-[#D9CBB8] rounded-lg p-3 md:p-4 bg-[#FFFDF9]"
                  >
                    <h3 className="text-lg md:text-xl font-bold text-[#5C4033] mb-3 md:mb-4">
                      {group}
                    </h3>

                    <div className="space-y-3">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className={`border p-3 md:p-4 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 ${getActionItemStyle(
                            item.type,
                          )}`}
                        >
                          <p className="text-sm md:text-base font-medium">
                            {item.message}
                          </p>

                          <Button href={item.link}>{item.linkText}</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </PageCard>

      {/* Dashboard Cards */}
      <div className="grid gap-3 md:grid-cols-2 md:gap-6">
        <DashboardCard href="/my-details" title="My Details">
          View and update your personal information.
        </DashboardCard>

        <DashboardCard href="/my-dogs" title="My Dogs">
          Add, edit or remove your dogs.
        </DashboardCard>

        <DashboardCard href="/my-bookings" title="My Bookings">
          View and manage your bookings.
        </DashboardCard>

        <DashboardCard href="/bookings" title="Book a Stay">
          Check availability and book a stay.
        </DashboardCard>

        {showMeetAndGreet && (
          <DashboardCard href="/meet-and-greet" title="Meet and Greet">
            Arrange your meet and greet sessions.
          </DashboardCard>
        )}
      </div>
    </CustomerPageLayout>
  );
}
