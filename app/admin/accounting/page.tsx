"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ensureActiveAdminUser } from "@/lib/appActions";
import {
  formatDisplayDate,
  formatMoney,
  formatName,
} from "@/lib/helpers";

import AdminPageLayout from "@/components/AdminPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import MessageBox from "@/components/MessageBox";
import LoadingScreen from "@/components/LoadingScreen";
import { FormSelect } from "@/components/FormInput";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Payment = {
  id: string;
  invoice_number: string;
  booking_id: string;
  owner_id: string;
  dog_id: string;
  amount: number;
  payment_type: string;
  payment_date: string;
  notes: string | null;
  created_at: string;
  dogs?: {
    name: string;
    breed: string | null;
  } | null;
  bookings?: {
    start_date: string;
    end_date: string;
  } | null;
  customer?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
};

type CustomerProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export default function AdminAccountingPage() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [message, setMessage] = useState("");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("All");
  const [dateRangeFilter, setDateRangeFilter] = useState("All");

  useEffect(() => {
    checkAdminAndLoadPayments();
  }, []);

  async function checkAdminAndLoadPayments() {
    setLoading(true);
    setMessage("");

    const { redirectTo } = await ensureActiveAdminUser();

    if (redirectTo) {
      window.location.href = redirectTo;
      return;
    }

    await loadPayments();

    setLoading(false);
  }

  async function loadPayments() {
    setMessage("");

    const { data, error } = await supabase
      .from("payments")
      .select(
        `
        id,
        invoice_number,
        booking_id,
        owner_id,
        dog_id,
        amount,
        payment_type,
        payment_date,
        notes,
        created_at,
        bookings (
          start_date,
          end_date
        ),
        dogs (
          name,
          breed
        )
        `
      )
      .order("payment_date", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    const paymentData = (data ?? []) as unknown as Payment[];

    const ownerIds = Array.from(
      new Set(paymentData.map((payment) => payment.owner_id))
    );

    let profiles: CustomerProfile[] = [];

    if (ownerIds.length > 0) {
      const { data: profileData, error: profileLoadError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", ownerIds);

      if (profileLoadError) {
        setMessage(profileLoadError.message);
        return;
      }

      profiles = profileData || [];
    }

    const paymentsWithCustomers = paymentData.map((payment) => {
      const customer = profiles.find(
        (profile) => profile.id === payment.owner_id
      );

      return {
        ...payment,
        customer: customer || null,
      };
    });

    setPayments(paymentsWithCustomers);
  }

  function getCustomerName(payment: Payment) {
    const firstName = payment.customer?.first_name || "";
    const lastName = payment.customer?.last_name || "";

    const fullName = `${firstName} ${lastName}`.trim();

    return fullName || payment.customer?.email || "Customer";
  }

  const totalReceived = payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  const depositTotal = payments
    .filter((payment) => payment.payment_type === "Deposit")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const balanceTotal = payments
    .filter((payment) => payment.payment_type === "Balance")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const latestPaymentDate =
    payments.length > 0 ? formatDisplayDate(payments[0].payment_date) : "None";

  const filteredPayments = payments.filter((payment) => {
    const paymentDate = new Date(payment.payment_date);

    let matchesDate = true;

    if (dateRangeFilter === "Month") {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 1);
      matchesDate = paymentDate >= cutoff;
    }

    if (dateRangeFilter === "6Months") {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 6);
      matchesDate = paymentDate >= cutoff;
    }

    if (dateRangeFilter === "Year") {
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      matchesDate = paymentDate >= cutoff;
    }

    const matchesType =
      paymentTypeFilter === "All" ||
      payment.payment_type === paymentTypeFilter;

    return matchesDate && matchesType;
  });

  function exportPaymentsPdf() {
    const doc = new jsPDF();

    const generatedDate = new Date().toLocaleDateString("en-GB");

    const total = filteredPayments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );

    doc.setFontSize(18);
    doc.text("Browns Boarding", 14, 18);

    doc.setFontSize(14);
    doc.text("Accounting Report", 14, 28);

    doc.setFontSize(10);
    doc.text(`Generated: ${generatedDate}`, 14, 36);
    doc.text(`Payment type: ${paymentTypeFilter}`, 14, 43);
    doc.text(`Date range: ${dateRangeFilter}`, 14, 50);

    doc.setFontSize(12);
    doc.text(`Total: ${formatMoney(total)}`, 14, 62);

autoTable(doc, {
    startY: 72,
    head: [
      [
        "Invoice",
        "Date Paid",
        "Booking Dates",
        "Customer",
        "Dog",
        "Type",
        "Notes",
        "Amount",
      ],
    ],
    body: filteredPayments.map((payment) => [
      payment.invoice_number,
      formatDisplayDate(payment.payment_date),
      payment.bookings
        ? `${formatDisplayDate(payment.bookings.start_date)} to ${formatDisplayDate(
            payment.bookings.end_date
          )}`
        : "-",
      getCustomerName(payment),
      formatName(payment.dogs?.name || "") || "Dog",
      payment.payment_type,
      payment.notes || "-",
      formatMoney(payment.amount),
    ]),
    foot: [
      [
        "",
        "",
        "",
        "",
        "",
        "",
        "Total",
        formatMoney(total),
      ],
    ],
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [139, 106, 78],
      textColor: [255, 255, 255],
    },
    footStyles: {
      fillColor: [245, 239, 230],
      textColor: [92, 64, 51],
      fontStyle: "bold",
    },
  });

  const filename = `browns-boarding-accounting-${generatedDate.replaceAll(
    "/",
    "-"
  )}.pdf`;

  doc.save(filename);
}

if (loading) {
  return <LoadingScreen message="Loading your details..." />;
}

  return (
    <AdminPageLayout>
      <PageCard
        title="Accounting"
        subtitle="View payment records, invoice numbers, deposits, balances and income."
        actions={
          <Button type="button" onClick={exportPaymentsPdf}>
            Export PDF
          </Button>
        }
      >
        {message && (
          <MessageBox type="error">
            {message}
          </MessageBox>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-green-50 border border-green-300 p-3 md:p-4 rounded-lg">
            <p className="text-xs md:text-base text-green-800 font-semibold">
              Total Received
            </p>

            <p className="mt-2 text-2xl mt-2 text-2xl font-bold text-green-900">
              {formatMoney(totalReceived)}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-300 p-3 md:p-4 rounded-lg">
            <p className="text-xs md:text-base text-blue-800 font-semibold">
              Deposits
            </p>

            <p className="mt-2 text-2xl mt-2 text-2xl font-bold text-blue-900">
              {formatMoney(depositTotal)}
            </p>
          </div>

          <div className="bg-teal-50 border border-teal-300 p-3 md:p-4 rounded-lg">
            <p className="text-xs md:text-base text-teal-800 font-semibold">
              Balances
            </p>

            <p className="mt-2 text-2xl mt-2 text-2xl font-bold text-teal-900">
              {formatMoney(balanceTotal)}
            </p>
          </div>

          <div className="bg-[#F5EFE6] border border-[#D9CBB8] p-3 md:p-4 rounded-lg">
            <p className="text-xs md:text-base text-[#8B6A4E] font-semibold">
              Latest Payment
            </p>

            <p className="mt-2 text-2xl mt-2 text-2xl font-bold text-[#5C4033]">
              {latestPaymentDate}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-5 md:mt-8 grid gap-3 md:grid-cols-2 md:gap-4">
          <FormSelect
            id="paymentType"
            label="Payment Type"
            value={paymentTypeFilter}
            onChange={(e) => setPaymentTypeFilter(e.target.value)}
          >
            <option value="All">All Payments</option>
            <option value="Deposit">Deposits</option>
            <option value="Balance">Balances</option>
          </FormSelect>

          <FormSelect
            id="dateRange"
            label="Date Range"
            value={dateRangeFilter}
            onChange={(e) => setDateRangeFilter(e.target.value)}
          >
            <option value="All">All Time</option>
            <option value="Month">Last Month</option>
            <option value="6Months">Last 6 Months</option>
            <option value="Year">Last 12 Months</option>
          </FormSelect>
        </div>

        {/* Payment Table */}
        <div className="mt-6 md:mt-10">
          <h2 className="text-xl md:text-2xl font-semibold text-[#5C4033] mb-4 md:mb-6">
            Invoices and Payments
          </h2>

          {filteredPayments.length === 0 ? (
            <p className="text-sm md:text-base text-[#8B6A4E]">
              No payments have been recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-5 md:mx-0">
              <table className="min-w-[900px] w-full border-collapse bg-white rounded-xl overflow-hidden shadow text-xs md:text-sm">
                <thead>
                  <tr className="bg-[#F5EFE6] text-left text-[#5C4033]">
                    <th className="p-3 md:p-4 border-b border-[#D9CBB8]">
                      Invoice
                    </th>

                    <th className="p-3 md:p-4 border-b border-[#D9CBB8]">
                      Date Paid
                    </th>

                    <th className="p-3 md:p-4 border-b border-[#D9CBB8]">
                      Booking Dates
                    </th>

                    <th className="p-3 md:p-4 border-b border-[#D9CBB8]">
                      Customer
                    </th>

                    <th className="p-3 md:p-4 border-b border-[#D9CBB8]">
                      Dog
                    </th>

                    <th className="p-3 md:p-4 border-b border-[#D9CBB8]">
                      Type
                    </th>

                    <th className="p-3 md:p-4 border-b border-[#D9CBB8]">
                      Notes
                    </th>

                    <th className="p-3 md:p-4 border-b border-[#D9CBB8] text-right">
                      Amount
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="text-[#5C4033] hover:bg-[#FFFDF9]"
                    >
                      <td className="p-3 md:p-4 border-b border-[#D9CBB8]">
                        <p className="font-semibold">
                          {payment.invoice_number}
                        </p>
                      </td>

                      <td className="p-3 md:p-4 border-b border-[#D9CBB8]">
                        {formatDisplayDate(payment.payment_date)}
                      </td>

                      <td className="p-3 md:p-4 border-b border-[#D9CBB8]">
                        {payment.bookings ? (
                          <>
                            <p>
                              {formatDisplayDate(
                                payment.bookings.start_date
                              )}
                            </p>

                            <p className="text-sm text-[#8B6A4E]">
                              to{" "}
                              {formatDisplayDate(
                                payment.bookings.end_date
                              )}
                            </p>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="p-3 md:p-4 border-b border-[#D9CBB8]">
                        <p>{getCustomerName(payment)}</p>

                        {payment.customer?.email && (
                          <p className="text-xs md:text-sm text-[#8B6A4E] break-all">
                            {payment.customer.email}
                          </p>
                        )}
                      </td>

                      <td className="p-3 md:p-4 border-b border-[#D9CBB8]">
                        {formatName(payment.dogs?.name || "") || "Dog"}
                      </td>

                      <td className="p-3 md:p-4 border-b border-[#D9CBB8]">
                        <span
                          className={`inline-flex w-fit items-center px-2.5 py-1 md:px-3 rounded-lg text-xs md:text-sm font-semibold ${
                            payment.payment_type === "Deposit"
                              ? "bg-blue-50 text-blue-800 border border-blue-300"
                              : "bg-teal-50 text-teal-800 border border-teal-300"
                          }`}
                        >
                          {payment.payment_type}
                        </span>
                      </td>

                      <td className="p-3 md:p-4 border-b border-[#D9CBB8]">
                        {payment.notes || "-"}
                      </td>

                      <td className="p-4 border-b border-[#D9CBB8] text-right font-semibold">
                        {formatMoney(payment.amount)}
                      </td>
                    </tr>
                  ))}

                  <tr className="bg-[#F5EFE6] font-bold text-[#5C4033]">
                    <td
                      colSpan={7}
                      className="p-3 md:p-4 border-t-2 border-[#D9CBB8] text-right"
                    >
                      Total
                    </td>

                    <td className="p-3 md:p-4 border-t-2 border-[#D9CBB8] text-right">
                      {formatMoney(
                        filteredPayments.reduce(
                          (sum, payment) =>
                            sum + Number(payment.amount || 0),
                          0
                        )
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageCard>
    </AdminPageLayout>
  );
}
``