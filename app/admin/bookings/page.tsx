"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ensureActiveAdminUser } from "@/lib/appActions";
import {
  formatDisplayDate,
  formatMoney,
  formatName,
  calculateNumberOfNights,
  isWithinTwoWeeks,
} from "@/lib/helpers";

import AdminPageLayout from "@/components/AdminPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import MessageBox from "@/components/MessageBox";
import LoadingScreen from "@/components/LoadingScreen";

type Booking = {
  id: string;
  booking_reference: string;
  owner_id: string;
  dog_id: string;
  start_date: string;
  end_date: string;
  status: string;
  notes: string | null;
  created_at: string;

  pricing_setting_id: string | null;
  nightly_rate: number | null;
  number_of_nights: number | null;
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

type CustomerProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type BookingWithCustomer = Booking & {
  customer?: CustomerProfile | null;
};

export default function AdminBookingsPage() {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingWithCustomer[]>([]);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("All");

  useEffect(() => {
    checkAdminAndLoadBookings();
  }, []);

  async function checkAdminAndLoadBookings() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    const { redirectTo } = await ensureActiveAdminUser();

    if (redirectTo) {
      window.location.href = redirectTo;
      return;
    }

    await autoCompleteEligibleBookings();
    await loadBookings();

    setLoading(false);
  }

  async function loadBookings() {
    setMessage("");
    setIsError(false);

    const { data, error } = await supabase
      .from("bookings")
      .select(
        `
        id,
        booking_reference,
        owner_id,
        dog_id,
        start_date,
        end_date,
        status,
        notes,
        created_at,
        pricing_setting_id,
        nightly_rate,
        number_of_nights,
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
      .order("start_date", { ascending: true });

    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }

    const bookingData = (data ?? []) as unknown as Booking[];

    const ownerIds = Array.from(
      new Set(bookingData.map((booking) => booking.owner_id))
    );

    let profiles: CustomerProfile[] = [];

    if (ownerIds.length > 0) {
      const { data: profileData, error: profileLoadError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", ownerIds);

      if (profileLoadError) {
        setIsError(true);
        setMessage(profileLoadError.message);
        return;
      }

      profiles = profileData || [];
    }

    const bookingsWithCustomers = bookingData.map((booking) => {
      const customer = profiles.find(
        (profile) => profile.id === booking.owner_id
      );

      return {
        ...booking,
        customer: customer || null,
      };
    });

    setBookings(bookingsWithCustomers);
  }

  function getCustomerName(booking: BookingWithCustomer) {
    const firstName = booking.customer?.first_name || "";
    const lastName = booking.customer?.last_name || "";

    const fullName = `${firstName} ${lastName}`.trim();

    return fullName || booking.customer?.email || "Customer";
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case "Pending":
        return "bg-amber-50 text-amber-800 border-amber-300";

      case "Deposit Pending":
        return "bg-green-50 text-green-800 border-green-300";

      case "Balance Pending":
        return "bg-blue-50 text-blue-800 border-blue-300";

      case "Balance Paid":
        return "bg-teal-50 text-teal-800 border-teal-300";

      case "Completed":
        return "bg-gray-50 text-gray-700 border-gray-300";

      case "Cancelled":
        return "bg-red-50 text-red-700 border-red-300";

      default:
        return "bg-gray-50 text-gray-700 border-gray-300";
    }
  }

  function getDisplayStatus(booking: BookingWithCustomer) {
    switch (booking.status) {
      case "Deposit Pending":
        return "Confirmed";

      case "Balance Pending":
        return booking.deposit_amount && booking.deposit_amount > 0
          ? "Deposit received"
          : "Balance due";

      case "Balance Paid":
        return "Full balance paid";

      case "Completed":
        return "Completed";

      case "Cancelled":
        return "Cancelled";

      default:
        return booking.status;
    }
  }

async function adjustAvailabilityForBooking(
  booking: BookingWithCustomer,
  change: number
) {
  const { error: availabilityError } = await supabase.rpc(
    "adjust_availability_for_booking",
    {
      p_start_date: booking.start_date,
      p_end_date: booking.end_date,
      p_change: change,
    }
  );

  if (availabilityError) {
    setIsError(true);
    setMessage(availabilityError.message);
    return false;
  }

  const { data: updatedAvailability, error: loadError } = await supabase
    .from("availability")
    .select(
      "id, date, available, total_spaces, spaces_available, notes"
    )
    .gte("date", booking.start_date)
    .lt("date", booking.end_date)
    .order("date", { ascending: true });

  if (loadError) {
    setIsError(true);
    setMessage(
      `Availability was updated, but the updated dates could not be loaded: ${loadError.message}`
    );
    return false;
  }

  let calendarSyncFailures = 0;

  for (const availabilityRecord of updatedAvailability || []) {
    try {
      const calendarResponse = await fetch(
        "/api/google/sync-availability-event",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            availabilityId: availabilityRecord.id,
            date: availabilityRecord.date,
            available: availabilityRecord.available,
            totalSpaces: availabilityRecord.total_spaces,
            spacesAvailable: availabilityRecord.spaces_available,
            notes: availabilityRecord.notes,
          }),
        }
      );

      if (!calendarResponse.ok) {
        calendarSyncFailures += 1;

        const calendarErrorText = await calendarResponse.text();

        console.error(
          `Google availability calendar sync failed for ${availabilityRecord.date}:`,
          calendarErrorText
        );
      }
    } catch (calendarError) {
      calendarSyncFailures += 1;

      console.error(
        `Google availability calendar sync failed for ${availabilityRecord.date}:`,
        calendarError
      );
    }
  }

  if (calendarSyncFailures > 0) {
    setIsError(true);
    setMessage(
      `Availability was updated, but ${calendarSyncFailures} availability calendar event(s) could not be synced.`
    );
    return false;
  }

  return true;
}

  async function confirmBooking(booking: BookingWithCustomer) {
    const shortNoticeBooking = isWithinTwoWeeks(booking.start_date);

    const confirmed = window.confirm(
      shortNoticeBooking
        ? "This booking starts within 14 days.\n\nConfirming this booking will skip the deposit stage and move it straight to Balance Pending."
        : "Are you sure you want to confirm this booking?\n\nThis will calculate the cost and move the booking to Deposit Pending."
    );

    if (!confirmed) return;

    setMessage("");
    setIsError(false);

    const { data: pricing, error: pricingError } = await supabase
      .from("pricing_settings")
      .select("id, nightly_rate, deposit_percentage")
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (pricingError || !pricing) {
      setIsError(true);
      setMessage("Unable to load active pricing settings.");
      return;
    }

    const numberOfNights = calculateNumberOfNights(
      booking.start_date,
      booking.end_date
    );

    const nightlyRate = Number(pricing.nightly_rate);
    const depositPercentage = Number(pricing.deposit_percentage);

    const totalCost = numberOfNights * nightlyRate;

    const depositAmount = shortNoticeBooking
      ? 0
      : totalCost * (depositPercentage / 100);

    const balanceAmount = totalCost - depositAmount;

    const newStatus = shortNoticeBooking
      ? "Balance Pending"
      : "Deposit Pending";

    const availabilityUpdated = await adjustAvailabilityForBooking(booking, -1);

    if (!availabilityUpdated) {
      await loadBookings();
      return;
    }

    const { error } = await supabase
      .from("bookings")
      .update({
        status: newStatus,
        pricing_setting_id: pricing.id,
        nightly_rate: nightlyRate,
        number_of_nights: numberOfNights,
        total_cost: totalCost,
        deposit_amount: depositAmount,
        balance_amount: balanceAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id);

      if (error) {
        setIsError(true);
        setMessage(error.message);
        return;
      }


const paymentStatus = shortNoticeBooking
  ? "Full balance due"
  : "Deposit due";

const calendarResponse = await fetch(
  "/api/google/create-booking-event",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bookingReference: booking.booking_reference,
      bookingId: booking.id,
      ownerName: getCustomerName(booking),
      ownerEmail: booking.customer?.email || null,
      dogName: formatName(booking.dogs?.name || "") || "Dog",
      dogBreed: booking.dogs?.breed
        ? formatName(booking.dogs.breed)
        : null,
      startDate: booking.start_date,
      endDate: booking.end_date,
      bookingStatus: newStatus,
      paymentStatus,
      totalCost: formatMoney(totalCost),
      depositAmount: formatMoney(depositAmount),
      balanceAmount: formatMoney(balanceAmount),
      notes: booking.notes,
    }),
  }
);

if (!calendarResponse.ok) {
  const calendarErrorText = await calendarResponse.text();

  console.error(
    "Google Calendar error status:",
    calendarResponse.status
  );

  console.error(
    "Google Calendar error response:",
    calendarErrorText
  );

  let calendarErrorMessage =
    "Booking confirmed, but the Google Calendar event could not be created.";

  try {
    const calendarError = JSON.parse(calendarErrorText);

    if (calendarError.error) {
      calendarErrorMessage = calendarError.error;
    }
  } catch {
    if (calendarErrorText) {
      calendarErrorMessage = calendarErrorText;
    }
  }

  setIsError(true);
  setMessage(calendarErrorMessage);

  await loadBookings();
  return;
}




      const emailResponse = await fetch(
  "/api/send-booking-confirmation-email",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingReference: booking.booking_reference,
          customerEmail: booking.customer?.email,
          customerName: getCustomerName(booking),
          dogName: formatName(booking.dogs?.name || "") || "your dog",
          startDate: formatDisplayDate(booking.start_date),
          endDate: formatDisplayDate(booking.end_date),
          totalCost: formatMoney(totalCost),
          depositAmount: formatMoney(depositAmount),
          balanceAmount: formatMoney(balanceAmount),
          shortNoticeBooking,
        }),
      }
    );

    if (!emailResponse.ok) {
      setIsError(true);
      setMessage(
        "Booking confirmed, but the confirmation email could not be sent."
      );

      await loadBookings();
      return;
    }

    setIsError(false);
    setMessage(
      shortNoticeBooking
        ? "Booking confirmed and confirmation email sent. Full balance is now due."
        : "Booking confirmed and deposit request email sent."
    );

    await loadBookings();
  }

async function cancelBooking(booking: BookingWithCustomer) {
  const confirmed = window.confirm(
    "Are you sure you want to cancel this booking?"
  );

  if (!confirmed) return;

  setMessage("");

  await fetch("/api/send-booking-cancelled-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bookingReference: booking.booking_reference,
      customerEmail: booking.customer?.email,
      customerName: getCustomerName(booking),
      dogName:
        formatName(booking.dogs?.name || "") || "your dog",
      startDate: formatDisplayDate(booking.start_date),
      endDate: formatDisplayDate(booking.end_date),
    }),
  });

  setIsError(false);

  const shouldRestoreAvailability = [
    "Deposit Pending",
    "Balance Pending",
    "Balance Paid",
  ].includes(booking.status);

  const { error } = await supabase
    .from("bookings")
    .update({
      status: "Cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id);

  if (error) {
    setIsError(true);
    setMessage(error.message);
    return;
  }

  if (shouldRestoreAvailability) {
    const availabilityUpdated = await adjustAvailabilityForBooking(
      booking,
      1
    );

    if (!availabilityUpdated) {
      await loadBookings();
      return;
    }

    const calendarResponse = await fetch(
      "/api/google/update-booking-event",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId: booking.id,
          bookingReference: booking.booking_reference,
          ownerName: getCustomerName(booking),
          ownerEmail: booking.customer?.email || null,
          dogName:
            formatName(booking.dogs?.name || "") || "Dog",
          dogBreed: booking.dogs?.breed
            ? formatName(booking.dogs.breed)
            : null,
          startDate: booking.start_date,
          endDate: booking.end_date,
          bookingStatus: "Cancelled",
          paymentStatus: "Cancelled",
          totalCost: formatMoney(
            Number(booking.total_cost || 0)
          ),
          depositAmount: formatMoney(
            Number(booking.deposit_amount || 0)
          ),
          balanceAmount: formatMoney(
            Number(booking.balance_amount || 0)
          ),
          notes: booking.notes,
        }),
      }
    );

    if (!calendarResponse.ok) {
      const calendarErrorText =
        await calendarResponse.text();

      console.error(
        "Google Calendar cancellation update error:",
        calendarErrorText
      );

      let calendarErrorMessage =
        "Booking cancelled and availability restored, but the Google Calendar event could not be updated.";

      try {
        const calendarError = JSON.parse(
          calendarErrorText
        );

        if (calendarError.error) {
          calendarErrorMessage = calendarError.error;
        }
      } catch {
        if (calendarErrorText) {
          calendarErrorMessage = calendarErrorText;
        }
      }

      setIsError(true);
      setMessage(calendarErrorMessage);

      await loadBookings();
      return;
    }
  }

  setIsError(false);

  setMessage(
    shouldRestoreAvailability
      ? "Booking cancelled, availability restored, and Google Calendar updated."
      : "Pending booking cancelled."
  );

  await loadBookings();
}

  async function recordPayment(
    booking: BookingWithCustomer,
    paymentType: string,
    amount: number,
    paymentDate: string
  ) {
    const { data, error } = await supabase
      .from("payments")
      .insert({
        booking_id: booking.id,
        owner_id: booking.owner_id,
        dog_id: booking.dog_id,
        amount,
        payment_type: paymentType,
        payment_date: paymentDate,
        notes: `${paymentType} payment recorded for ${
          formatName(booking.dogs?.name || "") || "dog"
        }`,
        updated_at: new Date().toISOString(),
      })
      .select("id, invoice_number")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async function markDepositPaid(booking: BookingWithCustomer) {
    const today = new Date();

    const todayFormatted = [
      String(today.getDate()).padStart(2, "0"),
      String(today.getMonth() + 1).padStart(2, "0"),
      today.getFullYear(),
    ].join("/");

    const depositPaidDateDisplay = window.prompt(
      "Enter the date the deposit was paid (DD/MM/YYYY):",
      todayFormatted
    );

    if (!depositPaidDateDisplay) return;

    const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;

    if (!datePattern.test(depositPaidDateDisplay)) {
      setIsError(true);
      setMessage("Please enter the deposit paid date in format DD/MM/YYYY.");
      return;
    }

    const [day, month, year] = depositPaidDateDisplay.split("/");

    const depositPaidDateDb = `${year}-${month}-${day}`;

    const confirmed = window.confirm(
      `Confirm deposit was paid on ${depositPaidDateDisplay}?\n\nThis will move the booking to Balance Pending, record the payment, and send a deposit receipt email to the customer.`
    );

    if (!confirmed) return;

    setMessage("");
    setIsError(false);

    const { error } = await supabase
      .from("bookings")
      .update({
        status: "Balance Pending",
        deposit_paid_at: depositPaidDateDb,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id);

    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }

    let paymentRecord;

    try {
      paymentRecord = await recordPayment(
        booking,
        "Deposit",
        Number(booking.deposit_amount || 0),
        depositPaidDateDb
      );
    } catch (paymentError) {
      setIsError(true);
      setMessage(
        paymentError instanceof Error
          ? paymentError.message
          : "Deposit marked as paid, but the payment record could not be saved."
      );

      await loadBookings();
      return;
    }

    const calendarResponse = await fetch(
  "/api/google/update-booking-event",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bookingId: booking.id,
      bookingReference: booking.booking_reference,
      ownerName: getCustomerName(booking),
      ownerEmail: booking.customer?.email || null,
      dogName: formatName(booking.dogs?.name || "") || "Dog",
      dogBreed: booking.dogs?.breed
        ? formatName(booking.dogs.breed)
        : null,
      startDate: booking.start_date,
      endDate: booking.end_date,
      bookingStatus: "Balance Pending",
      paymentStatus: "Deposit received, balance outstanding",
      totalCost: formatMoney(Number(booking.total_cost || 0)),
      depositAmount: formatMoney(Number(booking.deposit_amount || 0)),
      balanceAmount: formatMoney(Number(booking.balance_amount || 0)),
      notes: booking.notes,
    }),
  }
);

if (!calendarResponse.ok) {
  const calendarErrorText = await calendarResponse.text();

  console.error(
    "Google Calendar deposit update error:",
    calendarErrorText
  );

  let calendarErrorMessage =
    "Deposit recorded, but the Google Calendar event could not be updated.";

  try {
    const calendarError = JSON.parse(calendarErrorText);

    if (calendarError.error) {
      calendarErrorMessage = calendarError.error;
    }
  } catch {
    if (calendarErrorText) {
      calendarErrorMessage = calendarErrorText;
    }
  }

  setIsError(true);
  setMessage(calendarErrorMessage);

  await loadBookings();
  return;
}

    const emailResponse = await fetch("/api/send-deposit-received-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bookingId: booking.id,
        bookingReference: booking.booking_reference,
        customerEmail: booking.customer?.email,
        customerName: getCustomerName(booking),
        dogName: formatName(booking.dogs?.name || "") || "your dog",
        startDate: formatDisplayDate(booking.start_date),
        endDate: formatDisplayDate(booking.end_date),
        depositPaidDate: depositPaidDateDisplay,
        invoiceNumber: paymentRecord.invoice_number,
        depositAmount: formatMoney(Number(booking.deposit_amount || 0)),
      }),
    });

    if (!emailResponse.ok) {
      setIsError(true);
      setMessage(
        "Deposit marked as paid and payment recorded, but the confirmation email could not be sent."
      );

      await loadBookings();
      return;
    }

    await supabase
      .from("bookings")
      .update({
        deposit_received_email_sent: true,
        deposit_received_email_sent_at: new Date().toISOString(),
      })
      .eq("id", booking.id);

    setIsError(false);
    setMessage(
      "Deposit marked as paid, payment recorded, and confirmation email sent."
    );

    await loadBookings();
  }

  async function markBalancePaid(booking: BookingWithCustomer) {
    const today = new Date();

    const todayFormatted = [
      String(today.getDate()).padStart(2, "0"),
      String(today.getMonth() + 1).padStart(2, "0"),
      today.getFullYear(),
    ].join("/");

    const balancePaidDateDisplay = window.prompt(
      "Enter the date the balance was paid (DD/MM/YYYY):",
      todayFormatted
    );

    if (!balancePaidDateDisplay) return;

    const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;

    if (!datePattern.test(balancePaidDateDisplay)) {
      setIsError(true);
      setMessage("Please enter the balance paid date in format DD/MM/YYYY.");
      return;
    }

    const [day, month, year] = balancePaidDateDisplay.split("/");

    const balancePaidDateDb = `${year}-${month}-${day}`;

    const confirmed = window.confirm(
      `Confirm the remaining balance was paid on ${balancePaidDateDisplay}?\n\nThis will move the booking to Balance Paid, record the payment, and send a payment confirmation email to the customer.`
    );

    if (!confirmed) return;

    setMessage("");
    setIsError(false);

    const { error } = await supabase
      .from("bookings")
      .update({
        status: "Balance Paid",
        balance_paid_at: balancePaidDateDb,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id);

    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }

    let paymentRecord;

    try {
      paymentRecord = await recordPayment(
        booking,
        "Balance",
        Number(booking.balance_amount || 0),
        balancePaidDateDb
      );
    } catch (paymentError) {
      setIsError(true);
      setMessage(
        paymentError instanceof Error
          ? paymentError.message
          : "Balance marked as paid, but the payment record could not be saved."
      );

      await loadBookings();
      return;
    }

    const calendarResponse = await fetch(
  "/api/google/update-booking-event",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bookingId: booking.id,
      bookingReference: booking.booking_reference,
      ownerName: getCustomerName(booking),
      ownerEmail: booking.customer?.email || null,
      dogName: formatName(booking.dogs?.name || "") || "Dog",
      dogBreed: booking.dogs?.breed
        ? formatName(booking.dogs.breed)
        : null,
      startDate: booking.start_date,
      endDate: booking.end_date,
      bookingStatus: "Balance Paid",
      paymentStatus: "Fully paid",
      totalCost: formatMoney(Number(booking.total_cost || 0)),
      depositAmount: formatMoney(Number(booking.deposit_amount || 0)),
      balanceAmount: formatMoney(Number(booking.balance_amount || 0)),
      notes: booking.notes,
    }),
  }
);

if (!calendarResponse.ok) {
  const calendarErrorText = await calendarResponse.text();

  console.error(
    "Google Calendar balance update error:",
    calendarErrorText
  );

  let calendarErrorMessage =
    "Balance recorded, but the Google Calendar event could not be updated.";

  try {
    const calendarError = JSON.parse(calendarErrorText);

    if (calendarError.error) {
      calendarErrorMessage = calendarError.error;
    }
  } catch {
    if (calendarErrorText) {
      calendarErrorMessage = calendarErrorText;
    }
  }

  setIsError(true);
  setMessage(calendarErrorMessage);

  await loadBookings();
  return;
}

    const emailResponse = await fetch("/api/send-balance-received-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bookingId: booking.id,
        bookingReference: booking.booking_reference,
        customerEmail: booking.customer?.email,
        customerName: getCustomerName(booking),
        dogName: formatName(booking.dogs?.name || "") || "your dog",
        startDate: formatDisplayDate(booking.start_date),
        endDate: formatDisplayDate(booking.end_date),
        balancePaidDate: balancePaidDateDisplay,
        balanceAmount: formatMoney(Number(booking.balance_amount || 0)),
        invoiceNumber: paymentRecord.invoice_number,
      }),
    });

    if (!emailResponse.ok) {
      setIsError(true);
      setMessage(
        "Balance marked as paid and payment recorded, but the confirmation email could not be sent."
      );

      await loadBookings();
      return;
    }

    setIsError(false);
    setMessage(
      "Balance marked as paid, payment recorded, and confirmation email sent."
    );

    await loadBookings();
  }

async function autoCompleteEligibleBookings() {
  const today = new Date().toISOString().split("T")[0];

  const { data: eligibleBookings, error: loadError } = await supabase
    .from("bookings")
    .select(
      `
      id,
      booking_reference,
      owner_id,
      start_date,
      end_date,
      status,
      notes,
      total_cost,
      deposit_amount,
      balance_amount,
      dogs (
        name,
        breed
      )
      `
    )
    .eq("status", "Balance Paid")
    .lt("end_date", today);

  if (loadError) {
    setIsError(true);
    setMessage(loadError.message);
    return;
  }

  if (!eligibleBookings || eligibleBookings.length === 0) {
    return;
  }

  let calendarSyncFailures = 0;

  for (const booking of eligibleBookings) {
    const { error: bookingUpdateError } = await supabase
      .from("bookings")
      .update({
        status: "Completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id)
      .eq("status", "Balance Paid");

    if (bookingUpdateError) {
      setIsError(true);
      setMessage(bookingUpdateError.message);
      return;
    }

    const { data: customerProfile, error: profileError } =
      await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", booking.owner_id)
        .maybeSingle();

    if (profileError) {
      calendarSyncFailures += 1;

      console.error(
        `Unable to load customer for booking ${booking.booking_reference}:`,
        profileError.message
      );

      continue;
    }

    const customerName =
      `${customerProfile?.first_name || ""} ${
        customerProfile?.last_name || ""
      }`.trim() ||
      customerProfile?.email ||
      "Customer";

    const dogDetails = Array.isArray(booking.dogs)
      ? booking.dogs[0]
      : booking.dogs;

    try {
      const calendarResponse = await fetch(
        "/api/google/update-booking-event",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bookingId: booking.id,
            bookingReference: booking.booking_reference,
            ownerName: customerName,
            ownerEmail: customerProfile?.email || null,
            dogName: dogDetails?.name || "Dog",
            dogBreed: dogDetails?.breed || null,
            startDate: booking.start_date,
            endDate: booking.end_date,
            bookingStatus: "Completed",
            paymentStatus: "Fully paid",
            totalCost: formatMoney(
              Number(booking.total_cost || 0)
            ),
            depositAmount: formatMoney(
              Number(booking.deposit_amount || 0)
            ),
            balanceAmount: formatMoney(
              Number(booking.balance_amount || 0)
            ),
            notes: booking.notes,
          }),
        }
      );

      if (!calendarResponse.ok) {
        calendarSyncFailures += 1;

        const calendarErrorText =
          await calendarResponse.text();

        console.error(
          `Google Calendar completion update failed for ${booking.booking_reference}:`,
          calendarErrorText
        );
      }
    } catch (calendarError) {
      calendarSyncFailures += 1;

      console.error(
        `Google Calendar completion update failed for ${booking.booking_reference}:`,
        calendarError
      );
    }
  }

  if (calendarSyncFailures > 0) {
    setIsError(true);
    setMessage(
      `${eligibleBookings.length} booking(s) were completed, but ${calendarSyncFailures} Google Calendar event(s) could not be updated.`
    );
  }
}

  const pendingBookings = bookings.filter(
    (booking) => booking.status === "Pending"
  );

  const depositPendingBookings = bookings.filter(
    (booking) => booking.status === "Deposit Pending"
  );

  const balancePendingBookings = bookings.filter(
    (booking) => booking.status === "Balance Pending"
  );

  const balancePaidBookings = bookings.filter(
    (booking) => booking.status === "Balance Paid"
  );

  const completedBookings = bookings.filter(
    (booking) => booking.status === "Completed"
  );

  const cancelledBookings = bookings.filter(
    (booking) => booking.status === "Cancelled"
  );

  const filteredBookings =
    selectedFilter === "All"
      ? bookings
      : bookings.filter((booking) => booking.status === selectedFilter);

  if (loading) {
    return <LoadingScreen message="Loading admin bookings..." />;
  }

  function BookingCard({ booking }: { booking: BookingWithCustomer }) {
    return (
      <div className="bg-white border border-[#D9CBB8] rounded-xl p-4 md:p-6 shadow">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-semibold text-[#5C4033]">
              {formatName(booking.dogs?.name || "") || "Dog"}
            </h3>

            <p className="mt-1 text-xs font-semibold text-[#8B6A4E] md:text-sm">
              Booking reference: {booking.booking_reference}
            </p>

            {booking.dogs?.breed && (
              <p className="mt-1 text-sm md:text-base text-[#8B6A4E]">
                {formatName(booking.dogs.breed)}
              </p>
            )}

            <p className="mt-2 md:mt-3 text-sm md:text-base text-[#5C4033] font-medium">
              Stay dates: {formatDisplayDate(booking.start_date)} →{" "}
              {formatDisplayDate(booking.end_date)}
            </p>

            <p className="mt-2 md:mt-3 text-sm md:text-base text-[#8B6A4E]">
              Customer: {getCustomerName(booking)}
            </p>

            {booking.customer?.email && (
              <p className="mt-1 text-sm md:text-base text-[#8B6A4E] break-all">
                Email: {booking.customer.email}
              </p>
            )}

            {booking.total_cost && (
              <div className="mt-3 md:mt-4 bg-[#F5EFE6] border border-[#D9CBB8] p-3 md:p-4 rounded-lg">
                <p className="text-sm md:text-base text-[#5C4033] font-semibold">
                  Booking Cost
                </p>

                <p className="mt-1 md:mt-2 text-sm md:text-base text-[#8B6A4E]">
                  Total: {formatMoney(booking.total_cost)}
                </p>

                {booking.deposit_amount !== null && (
                  <p className="text-sm md:text-base text-[#8B6A4E]">
                    Deposit: {formatMoney(booking.deposit_amount)}
                  </p>
                )}

                {booking.balance_amount !== null && (
                  <p className="text-sm md:text-base text-[#8B6A4E]">
                    Balance: {formatMoney(booking.balance_amount)}
                  </p>
                )}

                {booking.number_of_nights && booking.nightly_rate && (
                  <p className="mt-2 text-xs md:text-sm text-[#8B6A4E]">
                    Based on {booking.number_of_nights} night
                    {booking.number_of_nights === 1 ? "" : "s"} at{" "}
                    {formatMoney(booking.nightly_rate)} per night.
                  </p>
                )}
              </div>
            )}

            {booking.notes && (
              <p className="mt-2 md:mt-3 text-sm md:text-base text-[#8B6A4E]">
                Notes: {booking.notes}
              </p>
            )}
          </div>

          {booking.status === "Balance Pending" && (
            <p className="mt-2 text-xs md:text-sm text-amber-700 font-medium">
              {booking.deposit_amount && booking.deposit_amount > 0
                ? "Deposit received. Awaiting remaining balance."
                : "Full balance due. No deposit required."}
            </p>
          )}


          <div className="flex flex-wrap md:flex-col gap-2 md:gap-3 md:items-end pt-1">
            <span
              className={`inline-flex w-fit items-center border px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-base font-semibold ${getStatusStyle(
                booking.status
              )}`}
            >
              {getDisplayStatus(booking)}
            </span>

            {booking.status === "Pending" && (
              <div className="flex flex-wrap md:flex-col gap-2">
                <Button
                  type="button"
                  variant="dark"
                  onClick={() => confirmBooking(booking)}
                >
                  Confirm Booking
                </Button>

                <button
                  type="button"
                  onClick={() => cancelBooking(booking)}
                  className="inline-flex w-fit items-center justify-center border border-red-400 text-red-600 px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-base rounded-lg font-semibold hover:bg-red-50 hover:scale-105 transition-all duration-300 cursor-pointer"
                >
                  Cancel Booking
                </button>
              </div>
            )}

              {booking.status === "Deposit Pending" && (
                <div className="flex flex-wrap gap-2 md:flex-col md:items-end">
                  <button
                    type="button"
                    onClick={() => markDepositPaid(booking)}
                    className="inline-flex w-fit items-center justify-center bg-green-600 text-white px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-base rounded-lg font-semibold hover:bg-green-700 hover:scale-105 transition-all duration-300 cursor-pointer"
                  >
                    Mark Deposit Paid
                  </button>

                  <button
                    type="button"
                    onClick={() => cancelBooking(booking)}
                    className="inline-flex w-fit items-center justify-center border border-red-400 text-red-600 px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-base rounded-lg font-semibold hover:bg-red-50 hover:scale-105 transition-all duration-300 cursor-pointer"
                  >
                    Cancel Booking
                  </button>
                </div>
              )}


            {booking.status === "Balance Pending" && (
              <div className="flex flex-wrap gap-2 md:flex-col md:items-end">

                <button
                  type="button"
                  onClick={() => markBalancePaid(booking)}
                  className="inline-flex w-fit items-center justify-center bg-green-600 text-white px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-base rounded-lg font-semibold hover:bg-green-700 hover:scale-105 transition-all duration-300 cursor-pointer"
                >
                  Mark Balance Paid
                </button>

                <button
                  type="button"
                  onClick={() => cancelBooking(booking)}
                  className="inline-flex w-fit items-center justify-center border border-red-400 text-red-600 px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-base rounded-lg font-semibold hover:bg-red-50 hover:scale-105 transition-all duration-300 cursor-pointer"
                >
                  Cancel Booking
                </button>
              </div>
            )}

            {booking.status === "Balance Paid" && (
              <div className="flex flex-wrap gap-2 md:flex-col md:items-end">
                <p className="text-xs md:text-sm text-[#8B6A4E] font-medium md:text-right">
                  Awaiting stay completion.
                </p>

                <button
                  type="button"
                  onClick={() => cancelBooking(booking)}
                  className="inline-flex w-fit items-center justify-center border border-red-400 text-red-600 px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-base rounded-lg font-semibold hover:bg-red-50 hover:scale-105 transition-all duration-300 cursor-pointer"
                >
                  Cancel Booking
                </button>
              </div>
            )}

            {booking.status === "Completed" && (
              <p className="text-xs md:text-sm text-blue-700 font-medium md:text-right">
                Booking completed.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminPageLayout>
      <PageCard
        title="Admin Bookings"
        subtitle="Review, confirm and manage customer booking requests."
      >
        {message && (
          <MessageBox type={isError ? "error" : "info"}>
            {message}
          </MessageBox>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          <div className="bg-amber-50 border border-amber-300 p-3 md:p-4 rounded-lg">
            <p className="text-amber-800 font-semibold text-xs md:text-base">
              Pending: {pendingBookings.length}
            </p>
          </div>

          <div className="bg-green-50 border border-green-300 p-3 md:p-4 rounded-lg">
            <p className="text-green-800 font-semibold text-xs md:text-base">
              Confirmed: {depositPendingBookings.length}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-300 p-3 md:p-4 rounded-lg">
            <p className="text-blue-800 font-semibold text-xs md:text-base">
              Deposit Received: {balancePendingBookings.length}
            </p>
          </div>

          <div className="bg-teal-50 border border-teal-300 p-3 md:p-4 rounded-lg">
            <p className="text-teal-800 font-semibold text-xs md:text-base">
              Full Balance Paid: {balancePaidBookings.length}
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-300 p-3 md:p-4 rounded-lg">
            <p className="text-gray-700 font-semibold text-xs md:text-base">
              Completed: {completedBookings.length}
            </p>
          </div>

          <div className="bg-red-50 border border-red-300 p-3 md:p-4 rounded-lg">
            <p className="text-red-700 font-semibold text-xs md:text-base">
              Cancelled: {cancelledBookings.length}
            </p>
          </div>
        </div>

        <div className="mt-5 md:mt-8 flex flex-wrap gap-2 md:gap-3">
          {[
            "All",
            "Pending",
            "Deposit Pending",
            "Balance Pending",
            "Balance Paid",
            "Completed",
            "Cancelled",
          ].map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setSelectedFilter(filter)}
              className={`px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-base rounded-lg font-semibold transition-all duration-300 cursor-pointer ${
                selectedFilter === filter
                  ? "bg-[#8B6A4E] text-white"
                  : "bg-white border border-[#D9CBB8] text-[#8B6A4E] hover:bg-[#F5EFE6]"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="mt-6 md:mt-10">
          <h2 className="text-xl md:text-2xl font-semibold text-[#5C4033] mb-4 md:mb-6">
            {selectedFilter === "All"
              ? "All Bookings"
              : `${selectedFilter} Bookings`}
          </h2>

          {filteredBookings.length === 0 ? (
            <p className="text-sm md:text-base text-[#8B6A4E]">
              There are no bookings to show for this filter.
            </p>
          ) : (
            <div className="space-y-4 md:space-y-6">
              {filteredBookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </div>
      </PageCard>
    </AdminPageLayout>
  );
}