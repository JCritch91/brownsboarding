"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  formatDisplayDate,
  formatMoney,
  formatName,
} from "@/lib/helpers";
import {
  ensureActiveAdminUser,
  getCurrentUser,
} from "@/lib/appActions";
import AdminPageLayout from "@/components/AdminPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import MessageBox from "@/components/MessageBox";
import LoadingScreen from "@/components/LoadingScreen";
import {
  authenticatedApiRequest,
} from "@/lib/client/authenticated-api";

type UpdateCustomerActiveStatusResponse = {
  success: boolean;
  customerStatusUpdated: boolean;
  customer?: {
    id: string;
    active: boolean;
  };
  message?: string;
  error?: string;
};

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
  activation_token: string | null;
  activated_at: string | null;
  created_at: string | null;
  is_admin: boolean | null;
};

type Dog = {
  id: string;
  name: string;
  breed: string | null;
  date_of_birth: string | null;
  weight_kg: number | null;
  gender: string | null;
  neutered: boolean | null;
  vaccinated: boolean | null;
  vaccination_expiry: string | null;
  microchip_number: string | null;
  meet_and_greet_completed: boolean | null;
  active: boolean;
};

type Booking = {
  id: string;
  booking_reference: string;
  dog_id: string;
  start_date: string;
  end_date: string;
  status: string;
  notes: string | null;
  total_cost: number | null;
  deposit_amount: number | null;
  balance_amount: number | null;
  deposit_paid_at: string | null;
  balance_paid_at: string | null;

  dogs: {
    name: string;
    breed: string | null;
  } | null;
};

export default function AdminCustomerDetailsPage() {
  const params = useParams<{ customerId: string }>();
  const customerId = params.customerId;

  const [loading, setLoading] = useState(true);

  const [customer, setCustomer] =
    useState<CustomerProfile | null>(null);

  const [dogs, setDogs] = useState<Dog[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");


  const [accountActionLoading, setAccountActionLoading] =
  useState(false);

  useEffect(() => {
    checkAdminAndLoadCustomer();
  }, [customerId]);

  async function toggleAdminStatus() {
    if (!customer || accountActionLoading) {
      return;
    }

    const makingAdmin = !customer.is_admin;

    if (customer.id === currentUserId && !makingAdmin) {
      setIsError(true);
      setMessage(
        "You cannot remove your own administrator access."
      );
      return;
    }

    const confirmed = window.confirm(
      makingAdmin
        ? `Grant administrator access to ${getCustomerName()}?`
        : `Remove administrator access from ${getCustomerName()}?`
    );

    if (!confirmed) {
      return;
    }

    setAccountActionLoading(true);
    setMessage("");
    setIsError(false);

    const { error } = await supabase
      .from("profiles")
      .update({
        is_admin: makingAdmin,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customer.id);

    if (error) {
      setAccountActionLoading(false);
      setIsError(true);
      setMessage(error.message);
      return;
    }

    setCustomer((current) =>
      current
        ? {
            ...current,
            is_admin: makingAdmin,
          }
        : current
    );

    setAccountActionLoading(false);
    setIsError(false);

    setMessage(
      makingAdmin
        ? "Administrator access granted."
        : "Administrator access removed."
    );
  }

  async function checkAdminAndLoadCustomer() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    const { redirectTo } = await ensureActiveAdminUser();

    if (redirectTo) {
      window.location.href = redirectTo;
      return;
    }

    const user = await getCurrentUser();
    setCurrentUserId(user.id);

    await loadCustomerData();
  }

  async function loadCustomerData() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    const [
      { data: customerData, error: customerError },
      { data: dogData, error: dogError },
      { data: bookingData, error: bookingError },
    ] = await Promise.all([
      supabase
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
          activation_token,
          activated_at,
          created_at,
          is_admin
          `
        )
        .eq("id", customerId)
        .or("is_admin.eq.false,is_admin.is.null")
        .maybeSingle(),

      supabase
        .from("dogs")
        .select(
          `
          id,
          name,
          breed,
          date_of_birth,
          weight_kg,
          gender,
          neutered,
          vaccinated,
          vaccination_expiry,
          microchip_number,
          meet_and_greet_completed,
          active
          `
        )
        .eq("owner_id", customerId)
        .order("name", { ascending: true }),

      supabase
        .from("bookings")
        .select(
          `
          id,
          booking_reference,
          dog_id,
          start_date,
          end_date,
          status,
          notes,
          total_cost,
          deposit_amount,
          balance_amount,
          deposit_paid_at,
          balance_paid_at,
          dogs (
            name,
            breed
          )
          `
        )
        .eq("owner_id", customerId)
        .order("start_date", { ascending: false }),
    ]);

    if (customerError) {
      setIsError(true);
      setMessage(customerError.message);
      setLoading(false);
      return;
    }

    if (!customerData) {
      setIsError(true);
      setMessage("Customer could not be found.");
      setLoading(false);
      return;
    }

    if (dogError) {
      setIsError(true);
      setMessage(dogError.message);
      setLoading(false);
      return;
    }

    if (bookingError) {
      setIsError(true);
      setMessage(bookingError.message);
      setLoading(false);
      return;
    }

    setCustomer(customerData as CustomerProfile);
    setDogs((dogData || []) as Dog[]);
    setBookings((bookingData || []) as unknown as Booking[]);
    setLoading(false);
  }

function formatAccountDate(dateString: string | null) {
  if (!dateString) {
    return "Not recorded";
  }

  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

async function toggleCustomerActiveStatus() {
  if (!customer) {
    return;
  }

  const requestedActiveStatus =
    !customer.active;

  const confirmed = window.confirm(
    requestedActiveStatus
      ? "Are you sure you want to activate this customer account?"
      : "Are you sure you want to deactivate this customer account?\n\nThe customer will no longer be able to access the customer portal."
  );

  if (!confirmed) {
    return;
  }

  setMessage("");
  setIsError(false);

  const result =
    await authenticatedApiRequest<UpdateCustomerActiveStatusResponse>(
      `/api/admin/customers/${customerId}/active-status`,
      {
        method: "PATCH",
        body: {
          active:
            requestedActiveStatus,
        },
      }
    );

  if (result.unauthenticated) {
    window.location.href = "/login";
    return;
  }

  if (!result.ok) {
    setIsError(true);
    setMessage(
      result.error ||
        "The customer account status could not be updated."
    );
    return;
  }

  if (
    !result.data ||
    !result.data.customerStatusUpdated
  ) {
    setIsError(true);
    setMessage(
      result.data?.error ||
        "The customer service did not update the account status."
    );
    return;
  }

  setIsError(false);

  setMessage(
    result.data.message ||
      (requestedActiveStatus
        ? "Customer account activated successfully."
        : "Customer account deactivated successfully.")
  );

  await loadCustomerData();
}

async function toggleMeetAndGreetApproval() {
  if (!customer || accountActionLoading) {
    return;
  }

  const newApprovalStatus =
    !customer.meet_and_greet_approved;

  const confirmed = window.confirm(
    newApprovalStatus
      ? `Mark ${getCustomerName()} as Meet & Greet approved?`
      : `Remove Meet & Greet approval for ${getCustomerName()}?`
  );

  if (!confirmed) {
    return;
  }

  setAccountActionLoading(true);
  setMessage("");
  setIsError(false);

  const { error } = await supabase
    .from("profiles")
    .update({
      meet_and_greet_approved: newApprovalStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customer.id);

  if (error) {
    setAccountActionLoading(false);
    setIsError(true);
    setMessage(error.message);
    return;
  }

  setCustomer((currentCustomer) =>
    currentCustomer
      ? {
          ...currentCustomer,
          meet_and_greet_approved: newApprovalStatus,
        }
      : currentCustomer
  );

  setAccountActionLoading(false);
  setIsError(false);
  setMessage(
    newApprovalStatus
      ? "Meet & Greet approval added successfully."
      : "Meet & Greet approval removed successfully."
  );
}

async function resendActivationEmail() {
  if (!customer || accountActionLoading) {
    return;
  }

  if (customer.was_activated) {
    setIsError(true);
    setMessage("This customer has already activated their account.");
    return;
  }

  if (!customer.activation_token) {
    setIsError(true);
    setMessage(
      "This customer does not currently have an activation token."
    );
    return;
  }

  const confirmed = window.confirm(
    `Send a new activation email to ${
      customer.email || getCustomerName()
    }?`
  );

  if (!confirmed) {
    return;
  }

  setAccountActionLoading(true);
  setMessage("");
  setIsError(false);

  const response = await fetch("/api/resend-activation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token: customer.activation_token,
    }),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    setAccountActionLoading(false);
    setIsError(true);
    setMessage(
      result?.error || "Unable to resend the activation email."
    );
    return;
  }

  setAccountActionLoading(false);
  setIsError(false);
  setMessage(
    result?.message || "A new activation email has been sent."
  );

  await loadCustomerData();
}



  function getCustomerName() {
    if (!customer) {
      return "Customer";
    }

    const firstName = formatName(customer.first_name || "");
    const lastName = formatName(customer.last_name || "");

    return (
      `${firstName} ${lastName}`.trim() ||
      customer.email ||
      "Customer"
    );
  }

  function getCustomerAddress() {
    if (!customer) {
      return "";
    }

    return [
      customer.address_line_1,
      customer.address_line_2,
      customer.town,
      customer.postcode,
    ]
      .filter(Boolean)
      .join(", ");
  }

  function getDogStatusStyle(dog: Dog) {
    if (!dog.active) {
      return "border-red-300 bg-red-50 text-red-700";
    }

    if (!dog.vaccinated) {
      return "border-amber-300 bg-amber-50 text-amber-800";
    }

    return "border-green-300 bg-green-50 text-green-800";
  }

  function getDogStatusText(dog: Dog) {
    if (!dog.active) {
      return "Inactive";
    }

    if (!dog.vaccinated) {
      return "Vaccination Required";
    }

    return "Active";
  }

  function getBookingStatusStyle(status: string) {
    switch (status) {
      case "Pending":
        return "border-amber-300 bg-amber-50 text-amber-800";

      case "Deposit Pending":
        return "border-green-300 bg-green-50 text-green-800";

      case "Balance Pending":
        return "border-blue-300 bg-blue-50 text-blue-800";

      case "Balance Paid":
        return "border-teal-300 bg-teal-50 text-teal-800";

      case "Completed":
        return "border-gray-300 bg-gray-50 text-gray-700";

      case "Cancelled":
        return "border-red-300 bg-red-50 text-red-700";

      default:
        return "border-gray-300 bg-gray-50 text-gray-700";
    }
  }

  function getBookingStatusText(status: string) {
    switch (status) {
      case "Pending":
        return "Pending Review";

      case "Deposit Pending":
        return "Confirmed";

      case "Balance Pending":
        return "Balance Pending";

      case "Balance Paid":
        return "Fully Paid";

      case "Completed":
        return "Completed";

      case "Cancelled":
        return "Cancelled";

      default:
        return status;
    }
  }

  const today = new Date().toISOString().split("T")[0];

  const currentBookings = bookings.filter(
    (booking) =>
      booking.end_date >= today &&
      booking.status !== "Cancelled" &&
      booking.status !== "Completed"
  );

  const historicBookings = bookings.filter(
    (booking) =>
      booking.end_date < today ||
      booking.status === "Cancelled" ||
      booking.status === "Completed"
  );

  if (loading) {
    return <LoadingScreen message="Loading customer..." />;
  }

  return (
    <AdminPageLayout>
      <PageCard
        title={getCustomerName()}
        subtitle="View and manage this customer, their dogs and bookings."
        actions={
        <Button href="/admin/customers">
            Back to Customers
          </Button>
        }
      >
        <div className="space-y-8 md:space-y-12">
          {message && (
            <MessageBox type={isError ? "error" : "success"}>
              {message}
            </MessageBox>
          )}

          {customer && (
            <>
              {/* Customer Details */}
              <section>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:mb-6">
                  <h2 className="text-xl font-semibold text-[#5C4033] md:text-2xl">
                    Customer Details
                  </h2>

                  <div className="flex flex-wrap gap-2">
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

                <div className="rounded-xl border border-[#D9CBB8] bg-white p-4 shadow-sm md:p-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-[#8B6A4E] md:text-sm">
                        Email
                      </p>

                      <p className="mt-1 break-all text-sm text-[#5C4033] md:text-base">
                        {customer.email || "Not provided"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#8B6A4E] md:text-sm">
                        Phone
                      </p>

                      <p className="mt-1 text-sm text-[#5C4033] md:text-base">
                        {customer.phone || "Not provided"}
                      </p>
                    </div>

                    <div className="md:col-span-2">
                      <p className="text-xs font-semibold text-[#8B6A4E] md:text-sm">
                        Address
                      </p>

                      <p className="mt-1 text-sm text-[#5C4033] md:text-base">
                        {getCustomerAddress() || "Not provided"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-end">
                    <Button href={`/admin/customers/${customer.id}/edit`}>
                      Edit Customer
                    </Button>

                    <Button href={`/admin/customers/${customer.id}/dogs/add`}>
                      Add Dog
                    </Button>

                    <Button href={`/admin/customers/${customer.id}/bookings/add`}>
                      Create Booking
                    </Button>
                  </div>
                </div>
              </section>

              {/* Account Management */}
              <section>
                <h2 className="mb-4 text-xl font-semibold text-[#5C4033] md:mb-6 md:text-2xl">
                  Account Management
                </h2>

                <div className="rounded-xl border border-[#D9CBB8] bg-white p-4 shadow-sm md:p-6">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-[#D9CBB8] bg-[#FFFDF9] p-3 md:p-4">
                      <p className="text-xs font-semibold text-[#8B6A4E] md:text-sm">
                        Account Status
                      </p>

                      <div className="mt-2">
                        {customer.active ? (
                          <span className="inline-flex w-fit items-center rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800 md:text-sm">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex w-fit items-center rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 md:text-sm">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#D9CBB8] bg-[#FFFDF9] p-3 md:p-4">
                      <p className="text-xs font-semibold text-[#8B6A4E] md:text-sm">
                        Activation Status
                      </p>

                      <div className="mt-2">
                        {customer.was_activated ? (
                          <span className="inline-flex w-fit items-center rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800 md:text-sm">
                            Activated
                          </span>
                        ) : (
                          <span className="inline-flex w-fit items-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 md:text-sm">
                            Not Activated
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#D9CBB8] bg-[#FFFDF9] p-3 md:p-4">
                      <p className="text-xs font-semibold text-[#8B6A4E] md:text-sm">
                        Meet & Greet
                      </p>

                      <div className="mt-2">
                        {customer.meet_and_greet_approved ? (
                          <span className="inline-flex w-fit items-center rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 md:text-sm">
                            Approved
                          </span>
                        ) : (
                          <span className="inline-flex w-fit items-center rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 md:text-sm">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#D9CBB8] bg-[#FFFDF9] p-3 md:p-4">
                      <p className="text-xs font-semibold text-[#8B6A4E] md:text-sm">
                        Account Created
                      </p>

                      <p className="mt-2 text-sm font-medium text-[#5C4033] md:text-base">
                        {formatAccountDate(customer.created_at)}
                      </p>
                    </div>
                  </div>

                  {customer.was_activated && (
                    <div className="mt-4 rounded-lg border border-[#D9CBB8] bg-[#F5EFE6] p-3 md:p-4">
                      <p className="text-xs font-semibold text-[#8B6A4E] md:text-sm">
                        Activated On
                      </p>

                      <p className="mt-1 text-sm font-medium text-[#5C4033] md:text-base">
                        {formatAccountDate(customer.activated_at)}
                      </p>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-end">
                    {customer.active ? (
                      <button
                        type="button"
                        onClick={toggleCustomerActiveStatus}
                        disabled={accountActionLoading}
                        className="inline-flex min-h-11 w-fit items-center justify-center rounded-lg border border-red-400 px-4 py-2 text-sm font-semibold text-red-600 transition-all duration-300 hover:scale-105 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 md:text-base"
                      >
                        {accountActionLoading
                          ? "Updating..."
                          : "Deactivate Customer"}
                      </button>
                    ) : (
                      <Button
                        type="button"
                        variant="dark"
                        onClick={toggleCustomerActiveStatus}
                        disabled={accountActionLoading}
                        className="disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                      >
                        {accountActionLoading
                          ? "Updating..."
                          : "Activate Customer"}
                      </Button>
                    )}

                    {customer.meet_and_greet_approved ? (
                      <button
                        type="button"
                        onClick={toggleMeetAndGreetApproval}
                        disabled={accountActionLoading}
                        className="inline-flex min-h-11 w-fit items-center justify-center rounded-lg border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-700 transition-all duration-300 hover:scale-105 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 md:text-base"
                      >
                        {accountActionLoading
                          ? "Updating..."
                          : "Remove Meet & Greet Approval"}
                      </button>
                    ) : (
                      <Button
                        type="button"
                        variant="dark"
                        onClick={toggleMeetAndGreetApproval}
                        disabled={accountActionLoading}
                        className="disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                      >
                        {accountActionLoading
                          ? "Updating..."
                          : "Approve Meet & Greet"}
                      </Button>
                    )}

                    {!customer.was_activated && (
                      <Button
                        type="button"
                        variant="light"
                        onClick={resendActivationEmail}
                        disabled={accountActionLoading}
                        className="disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                      >
                        {accountActionLoading
                          ? "Sending..."
                          : "Resend Activation Email"}
                      </Button>
                    )}
                  </div>
                </div>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[#5C4033]">
                  Role Management
                </h2>

                <div className="rounded-xl border border-[#D9CBB8] bg-white p-4 md:p-6">
                  <p className="text-sm text-[#5C4033]">
                    Current Role:
                    <strong>
                      {" "}
                      {customer.is_admin
                        ? "Administrator"
                        : "Customer"}
                    </strong>
                  </p>

                  <div className="mt-4">
                    {customer.is_admin ? (
                      <button
                        type="button"
                        onClick={toggleAdminStatus}
                        className="inline-flex min-h-11 items-center rounded-lg border border-red-400 px-4 py-2 font-semibold text-red-600 hover:bg-red-50"
                      >
                        Remove Admin Access
                      </button>
                    ) : (
                      <Button
                        type="button"
                        variant="dark"
                        onClick={toggleAdminStatus}
                      >
                        Promote To Admin
                      </Button>
                    )}
                  </div>
                </div>
              </section>

              {/* Emergency Contact and Vet */}
              <section>
                <h2 className="mb-4 text-xl font-semibold text-[#5C4033] md:mb-6 md:text-2xl">
                  Emergency Contact & Vet
                </h2>

                <div className="grid gap-4 md:grid-cols-2 md:gap-6">
                  <div className="rounded-xl border border-[#D9CBB8] bg-white p-4 shadow-sm md:p-6">
                    <h3 className="text-lg font-semibold text-[#5C4033] md:text-xl">
                      Emergency Contact
                    </h3>

                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-[#8B6A4E] md:text-sm">
                          Name
                        </p>

                        <p className="mt-1 text-sm text-[#5C4033] md:text-base">
                          {customer.emergency_contact_name
                            ? formatName(
                                customer.emergency_contact_name
                              )
                            : "Not provided"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-[#8B6A4E] md:text-sm">
                          Phone
                        </p>

                        <p className="mt-1 text-sm text-[#5C4033] md:text-base">
                          {customer.emergency_contact_phone ||
                            "Not provided"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#D9CBB8] bg-white p-4 shadow-sm md:p-6">
                    <h3 className="text-lg font-semibold text-[#5C4033] md:text-xl">
                      Veterinary Practice
                    </h3>

                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-[#8B6A4E] md:text-sm">
                          Practice Name
                        </p>

                        <p className="mt-1 text-sm text-[#5C4033] md:text-base">
                          {customer.vet_name
                            ? formatName(customer.vet_name)
                            : "Not provided"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-[#8B6A4E] md:text-sm">
                          Phone
                        </p>

                        <p className="mt-1 text-sm text-[#5C4033] md:text-base">
                          {customer.vet_phone || "Not provided"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-[#8B6A4E] md:text-sm">
                          Address
                        </p>

                        <p className="mt-1 text-sm text-[#5C4033] md:text-base">
                          {customer.vet_address || "Not provided"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Dogs */}
              <section>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 md:mb-6">
                  <h2 className="text-xl font-semibold text-[#5C4033] md:text-2xl">
                    Dogs
                  </h2>

                  <Button href={`/admin/customers/${customer.id}/dogs/add`}>
                    Add Dog
                  </Button>
                </div>

                {dogs.length === 0 ? (
                  <div className="rounded-xl border border-[#D9CBB8] bg-[#FFFDF9] p-6 text-center md:p-8">
                    <p className="text-sm text-[#8B6A4E] md:text-base">
                      This customer does not have any dogs yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 md:gap-6">
                    {dogs.map((dog) => (
                      <article
                        key={dog.id}
                        className="rounded-xl border border-[#D9CBB8] bg-white p-4 shadow-sm md:p-6"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="text-xl font-semibold text-[#5C4033]">
                              {formatName(dog.name)}
                            </h3>

                            {dog.breed && (
                              <p className="mt-1 text-sm text-[#8B6A4E] md:text-base">
                                {formatName(dog.breed)}
                              </p>
                            )}
                          </div>

                          <span
                            className={`inline-flex w-fit items-center rounded-lg border px-3 py-1.5 text-xs font-semibold md:text-sm ${getDogStatusStyle(
                              dog
                            )}`}
                          >
                            {getDogStatusText(dog)}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs font-semibold text-[#8B6A4E] md:text-sm">
                              Gender
                            </p>

                            <p className="mt-1 text-sm text-[#5C4033] md:text-base">
                              {dog.gender || "Not provided"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-[#8B6A4E] md:text-sm">
                              Weight
                            </p>

                            <p className="mt-1 text-sm text-[#5C4033] md:text-base">
                              {dog.weight_kg !== null
                                ? `${dog.weight_kg} kg`
                                : "Not provided"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-[#8B6A4E] md:text-sm">
                              Vaccinated
                            </p>

                            <p className="mt-1 text-sm text-[#5C4033] md:text-base">
                              {dog.vaccinated ? "Yes" : "No"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-[#8B6A4E] md:text-sm">
                              Meet & Greet
                            </p>

                            <p className="mt-1 text-sm text-[#5C4033] md:text-base">
                              {dog.meet_and_greet_completed
                                ? "Completed"
                                : "Required"}
                            </p>
                          </div>
                        </div>

                        {dog.vaccination_expiry && (
                          <div className="mt-4 rounded-lg border border-[#D9CBB8] bg-[#F5EFE6] p-3">
                            <p className="text-xs font-semibold text-[#8B6A4E] md:text-sm">
                              Vaccination Expiry
                            </p>

                            <p className="mt-1 text-sm text-[#5C4033] md:text-base">
                              {formatDisplayDate(
                                dog.vaccination_expiry
                              )}
                            </p>
                          </div>
                        )}

                        <div className="mt-5 flex justify-center sm:justify-end">
                          <Button
                            href={`/admin/customers/${customer.id}/dogs/${dog.id}/edit`}>
                            Edit Dog
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              {/* Current and Upcoming Bookings */}
              <section>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 md:mb-6">
                  <h2 className="text-xl font-semibold text-[#5C4033] md:text-2xl">
                    Current & Upcoming Bookings
                  </h2>

                  <Button href={`/admin/customers/${customer.id}/bookings/add`}>
                    Create Booking
                  </Button>
                </div>

                {currentBookings.length === 0 ? (
                  <div className="rounded-xl border border-[#D9CBB8] bg-[#FFFDF9] p-6 text-center md:p-8">
                    <p className="text-sm text-[#8B6A4E] md:text-base">
                      This customer has no current or upcoming bookings.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 md:space-y-6">
                    {currentBookings.map((booking) => (
                      <article
                        key={booking.id}
                        className="rounded-xl border border-[#D9CBB8] bg-white p-4 shadow-sm md:p-6"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="text-xl font-semibold text-[#5C4033]">
                              {formatName(
                                booking.dogs?.name || "Dog"
                              )}
                            </h3>

                            {booking.dogs?.breed && (
                              <p className="mt-1 text-sm text-[#8B6A4E] md:text-base">
                                {formatName(booking.dogs.breed)}
                              </p>
                            )}

                            <p className="mt-2 text-xs font-semibold text-[#8B6A4E] md:text-sm">
                              Booking reference:{" "}
                              {booking.booking_reference}
                            </p>

                            <p className="mt-3 text-sm font-medium text-[#5C4033] md:text-base">
                              {formatDisplayDate(
                                booking.start_date
                              )}{" "}
                              to{" "}
                              {formatDisplayDate(booking.end_date)}
                            </p>

                            {booking.total_cost !== null && (
                              <div className="mt-3 rounded-lg border border-[#D9CBB8] bg-[#F5EFE6] p-3">
                                <p className="text-sm text-[#8B6A4E] md:text-base">
                                  Total cost:{" "}
                                  {formatMoney(booking.total_cost)}
                                </p>

                                {booking.deposit_amount !== null && (
                                  <p className="mt-1 text-sm text-[#8B6A4E] md:text-base">
                                    Deposit:{" "}
                                    {formatMoney(
                                      booking.deposit_amount
                                    )}
                                  </p>
                                )}

                                {booking.balance_amount !== null && (
                                  <p className="mt-1 text-sm text-[#8B6A4E] md:text-base">
                                    Balance:{" "}
                                    {formatMoney(
                                      booking.balance_amount
                                    )}
                                  </p>
                                )}
                              </div>
                            )}

                            {booking.notes && (
                              <p className="mt-3 text-sm text-[#8B6A4E] md:text-base">
                                Notes: {booking.notes}
                              </p>
                            )}
                          </div>

                          <span
                            className={`inline-flex w-fit items-center rounded-lg border px-3 py-1.5 text-xs font-semibold md:text-sm ${getBookingStatusStyle(
                              booking.status
                            )}`}
                          >
                            {getBookingStatusText(booking.status)}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              {/* Historic Bookings */}
              <section>
                <h2 className="mb-4 text-xl font-semibold text-[#5C4033] md:mb-6 md:text-2xl">
                  Historic Bookings
                </h2>

                {historicBookings.length === 0 ? (
                  <div className="rounded-xl border border-[#D9CBB8] bg-[#FFFDF9] p-6 text-center md:p-8">
                    <p className="text-sm text-[#8B6A4E] md:text-base">
                      This customer has no historic bookings.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 md:space-y-6">
                    {historicBookings.map((booking) => (
                      <article
                        key={booking.id}
                        className="rounded-xl border border-[#D9CBB8] bg-white p-4 shadow-sm md:p-6"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-[#5C4033] md:text-xl">
                              {formatName(
                                booking.dogs?.name || "Dog"
                              )}
                            </h3>

                            {booking.dogs?.breed && (
                              <p className="mt-1 text-sm text-[#8B6A4E] md:text-base">
                                {formatName(booking.dogs.breed)}
                              </p>
                            )}

                            <p className="mt-2 text-xs font-semibold text-[#8B6A4E] md:text-sm">
                              Booking reference:{" "}
                              {booking.booking_reference}
                            </p>

                            <p className="mt-3 text-sm font-medium text-[#5C4033] md:text-base">
                              {formatDisplayDate(
                                booking.start_date
                              )}{" "}
                              to{" "}
                              {formatDisplayDate(booking.end_date)}
                            </p>

                            {booking.total_cost !== null && (
                              <p className="mt-2 text-sm text-[#8B6A4E] md:text-base">
                                Total cost:{" "}
                                {formatMoney(booking.total_cost)}
                              </p>
                            )}

                            {booking.notes && (
                              <p className="mt-3 text-sm text-[#8B6A4E] md:text-base">
                                Notes: {booking.notes}
                              </p>
                            )}
                          </div>

                          <span
                            className={`inline-flex w-fit items-center rounded-lg border px-3 py-1.5 text-xs font-semibold md:text-sm ${getBookingStatusStyle(
                              booking.status
                            )}`}
                          >
                            {getBookingStatusText(booking.status)}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </PageCard>
    </AdminPageLayout>
  );
}