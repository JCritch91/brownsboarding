import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  formatDisplayDate,
  formatMoney,
  formatName,
} from "@/lib/helpers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type PaymentType = "Deposit" | "Balance";

type RecordPaymentRequestBody = {
  bookingId?: unknown;
  paymentType?: unknown;
  paymentDate?: unknown;
};

function isValidPaymentType(
  value: unknown
): value is PaymentType {
  return value === "Deposit" || value === "Balance";
}

function isValidDatabaseDate(
  value: unknown
): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

async function getResponseError(
  response: Response,
  fallbackMessage: string
) {
  const responseText = await response.text();

  if (!responseText) {
    return fallbackMessage;
  }

  try {
    const responseData = JSON.parse(responseText);

    return responseData.error || fallbackMessage;
  } catch {
    return responseText;
  }
}

export async function POST(request: Request) {
  try {
    const authorizationHeader =
      request.headers.get("authorization");

    const accessToken =
      authorizationHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "You must be signed in as an administrator.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(
      accessToken
    );

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "Unable to verify the signed-in user.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: adminProfile,
      error: adminProfileError,
    } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        is_admin,
        active
        `
      )
      .eq("id", user.id)
      .maybeSingle();

    if (adminProfileError) {
      return NextResponse.json(
        {
          error: adminProfileError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      !adminProfile ||
      !adminProfile.is_admin ||
      !adminProfile.active
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to record booking payments.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      (await request.json()) as RecordPaymentRequestBody;

    const bookingId = body.bookingId;
    const paymentType = body.paymentType;
    const paymentDate = body.paymentDate;

    if (
      typeof bookingId !== "string" ||
      !bookingId.trim()
    ) {
      return NextResponse.json(
        {
          error: "Booking ID is missing.",
        },
        {
          status: 400,
        }
      );
    }

    if (!isValidPaymentType(paymentType)) {
      return NextResponse.json(
        {
          error:
            "Payment type must be Deposit or Balance.",
        },
        {
          status: 400,
        }
      );
    }

    if (!isValidDatabaseDate(paymentDate)) {
      return NextResponse.json(
        {
          error:
            "Payment date must be a valid date in YYYY-MM-DD format.",
        },
        {
          status: 400,
        }
      );
    }

    const today =
      new Date().toISOString().split("T")[0];

    if (paymentDate > today) {
      return NextResponse.json(
        {
          error:
            "The payment date cannot be in the future.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Load the booking before the atomic update so the
     * route can validate the requested payment stage and
     * retain the details required for calendar and email
     * follow-up operations.
     */
    const {
      data: booking,
      error: bookingLoadError,
    } = await supabaseAdmin
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
        total_cost,
        deposit_amount,
        balance_amount
        `
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingLoadError) {
      return NextResponse.json(
        {
          error: bookingLoadError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!booking) {
      return NextResponse.json(
        {
          error: "Booking could not be found.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      paymentType === "Deposit" &&
      booking.status !== "Deposit Pending"
    ) {
      return NextResponse.json(
        {
          error:
            `A deposit cannot be recorded while the booking status is "${booking.status}".`,
        },
        {
          status: 409,
        }
      );
    }

    if (
      paymentType === "Balance" &&
      booking.status !== "Balance Pending"
    ) {
      return NextResponse.json(
        {
          error:
            `A balance payment cannot be recorded while the booking status is "${booking.status}".`,
        },
        {
          status: 409,
        }
      );
    }

    const {
      data: customer,
      error: customerLoadError,
    } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        first_name,
        last_name,
        email
        `
      )
      .eq("id", booking.owner_id)
      .maybeSingle();

    if (customerLoadError) {
      return NextResponse.json(
        {
          error: customerLoadError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!customer) {
      return NextResponse.json(
        {
          error:
            "The customer associated with this booking could not be found.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      data: dog,
      error: dogLoadError,
    } = await supabaseAdmin
      .from("dogs")
      .select(
        `
        id,
        owner_id,
        name,
        breed
        `
      )
      .eq("id", booking.dog_id)
      .eq("owner_id", booking.owner_id)
      .maybeSingle();

    if (dogLoadError) {
      return NextResponse.json(
        {
          error: dogLoadError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!dog) {
      return NextResponse.json(
        {
          error:
            "The dog associated with this booking could not be found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Atomically create the payment record and update
     * the booking status and paid date.
     */
    const {
      data: paymentRows,
      error: paymentError,
    } = await supabaseAdmin.rpc(
      "record_booking_payment_atomic",
      {
        p_booking_id: booking.id,
        p_payment_type: paymentType,
        p_payment_date: paymentDate,
      }
    );

    if (paymentError) {
      console.error(
        "Atomic booking payment failed:",
        paymentError
      );

      const errorMessage =
        paymentError.message ||
        "The payment could not be recorded.";

      if (
        errorMessage.includes(
          "PAYMENT_ALREADY_RECORDED"
        )
      ) {
        return NextResponse.json(
          {
            error:
              `The ${paymentType.toLowerCase()} payment has already been recorded.`,
          },
          {
            status: 409,
          }
        );
      }

      if (
        errorMessage.includes(
          "INVALID_DEPOSIT_STATUS"
        )
      ) {
        return NextResponse.json(
          {
            error:
              "The booking is no longer awaiting a deposit.",
          },
          {
            status: 409,
          }
        );
      }

      if (
        errorMessage.includes(
          "INVALID_BALANCE_STATUS"
        )
      ) {
        return NextResponse.json(
          {
            error:
              "The booking is no longer awaiting its balance.",
          },
          {
            status: 409,
          }
        );
      }

      if (
        errorMessage.includes(
          "PAYMENT_DATE_IN_FUTURE"
        )
      ) {
        return NextResponse.json(
          {
            error:
              "The payment date cannot be in the future.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        errorMessage.includes(
          "BOOKING_NOT_FOUND"
        )
      ) {
        return NextResponse.json(
          {
            error: "Booking could not be found.",
          },
          {
            status: 404,
          }
        );
      }

      if (
        errorMessage.includes(
          "DEPOSIT_AMOUNT_MISSING"
        ) ||
        errorMessage.includes(
          "INVALID_DEPOSIT_AMOUNT"
        )
      ) {
        return NextResponse.json(
          {
            error:
              "The booking does not contain a valid deposit amount.",
          },
          {
            status: 409,
          }
        );
      }

      if (
        errorMessage.includes(
          "BALANCE_AMOUNT_MISSING"
        ) ||
        errorMessage.includes(
          "INVALID_BALANCE_AMOUNT"
        )
      ) {
        return NextResponse.json(
          {
            error:
              "The booking does not contain a valid balance amount.",
          },
          {
            status: 409,
          }
        );
      }

      return NextResponse.json(
        {
          error: errorMessage,
        },
        {
          status: 500,
        }
      );
    }

    const paymentResult =
      Array.isArray(paymentRows)
        ? paymentRows[0]
        : paymentRows;

    if (!paymentResult) {
      return NextResponse.json(
        {
          error:
            "The payment completed without returning a payment result.",
        },
        {
          status: 500,
        }
      );
    }

    const customerName =
      `${customer.first_name || ""} ${
        customer.last_name || ""
      }`.trim() ||
      customer.email ||
      "Customer";

    const dogName =
      formatName(dog.name || "") || "Dog";

    const dogBreed = dog.breed
      ? formatName(dog.breed)
      : null;

    const newStatus =
      paymentType === "Deposit"
        ? "Balance Pending"
        : "Balance Paid";

    const paymentStatus =
      paymentType === "Deposit"
        ? "Deposit received, balance outstanding"
        : "Fully paid";

    const requestOrigin =
      new URL(request.url).origin;

    /*
     * Calendar and email are independent follow-up
     * operations, so run both concurrently.
     */
    const calendarOperation = async () => {
      const calendarResponse = await fetch(
        `${requestOrigin}/api/google/update-booking-event`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            bookingId: booking.id,
            bookingReference:
              booking.booking_reference,
            ownerName: customerName,
            ownerEmail:
              customer.email || null,
            dogName,
            dogBreed,
            startDate: booking.start_date,
            endDate: booking.end_date,
            bookingStatus: newStatus,
            paymentStatus,
            totalCost: formatMoney(
              Number(booking.total_cost || 0)
            ),
            depositAmount: formatMoney(
              Number(
                booking.deposit_amount || 0
              )
            ),
            balanceAmount: formatMoney(
              Number(
                booking.balance_amount || 0
              )
            ),
            notes: booking.notes,
          }),
        }
      );

      if (!calendarResponse.ok) {
        throw new Error(
          await getResponseError(
            calendarResponse,
            "The Google booking calendar could not be updated."
          )
        );
      }
    };

    const emailOperation = async () => {
      if (!customer.email) {
        throw new Error(
          "The customer does not have an email address."
        );
      }

      if (paymentType === "Deposit") {
        const emailResponse = await fetch(
          `${requestOrigin}/api/send-deposit-received-email`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              bookingId: booking.id,
              bookingReference:
                booking.booking_reference,
              customerEmail:
                customer.email,
              customerName,
              dogName,
              startDate:
                formatDisplayDate(
                  booking.start_date
                ),
              endDate:
                formatDisplayDate(
                  booking.end_date
                ),
              depositPaidDate:
                formatDisplayDate(paymentDate),
              invoiceNumber:
                paymentResult.invoice_number,
              depositAmount:
                formatMoney(
                  Number(
                    paymentResult.payment_amount
                  )
                ),
            }),
          }
        );

        if (!emailResponse.ok) {
          throw new Error(
            await getResponseError(
              emailResponse,
              "The deposit receipt email could not be sent."
            )
          );
        }

        return;
      }

      const emailResponse = await fetch(
        `${requestOrigin}/api/send-balance-received-email`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            bookingId: booking.id,
            bookingReference:
              booking.booking_reference,
            customerEmail:
              customer.email,
            customerName,
            dogName,
            startDate:
              formatDisplayDate(
                booking.start_date
              ),
            endDate:
              formatDisplayDate(
                booking.end_date
              ),
            balancePaidDate:
              formatDisplayDate(paymentDate),
            balanceAmount:
              formatMoney(
                Number(
                  paymentResult.payment_amount
                )
              ),
            invoiceNumber:
              paymentResult.invoice_number,
          }),
        }
      );

      if (!emailResponse.ok) {
        throw new Error(
          await getResponseError(
            emailResponse,
            "The balance receipt email could not be sent."
          )
        );
      }
    };

    const [
      calendarResult,
      emailResult,
    ] = await Promise.allSettled([
      calendarOperation(),
      emailOperation(),
    ]);

    const calendarUpdated =
      calendarResult.status === "fulfilled";

    const emailSent =
      emailResult.status === "fulfilled";

    const calendarError =
      calendarResult.status === "rejected"
        ? calendarResult.reason instanceof Error
          ? calendarResult.reason.message
          : "Unknown Google Calendar error."
        : null;

    const emailError =
      emailResult.status === "rejected"
        ? emailResult.reason instanceof Error
          ? emailResult.reason.message
          : "Unknown payment email error."
        : null;

    if (!calendarUpdated) {
      console.error(
        `Payment calendar update failed for ${booking.booking_reference}:`,
        calendarResult.status === "rejected"
          ? calendarResult.reason
          : calendarError
      );
    }

    if (!emailSent) {
      console.error(
        `Payment receipt email failed for ${booking.booking_reference}:`,
        emailResult.status === "rejected"
          ? emailResult.reason
          : emailError
      );
    }

    const followUpRequired =
      !calendarUpdated || !emailSent;

    const failedOperations: string[] = [];

    if (!calendarUpdated) {
      failedOperations.push(
        "the Google booking calendar update"
      );
    }

    if (!emailSent) {
      failedOperations.push(
        paymentType === "Deposit"
          ? "the deposit receipt email"
          : "the balance receipt email"
      );
    }

    return NextResponse.json(
      {
        success: true,
        paymentRecorded: true,
        followUpRequired,

        payment: {
          id: paymentResult.payment_id,
          invoiceNumber:
            paymentResult.invoice_number,
          type: paymentType,
          amount: Number(
            paymentResult.payment_amount
          ),
          date: paymentDate,
        },

        booking: {
          id: booking.id,
          bookingReference:
            booking.booking_reference,
          previousStatus:
            booking.status,
          newStatus,
        },

        calendar: {
          updated: calendarUpdated,
          error: calendarError,
        },

        email: {
          sent: emailSent,
          error: emailError,
        },

        message: followUpRequired
          ? `The ${paymentType.toLowerCase()} payment was recorded, but the following operation(s) could not be completed: ${failedOperations.join(
              ", "
            )}.`
          : paymentType === "Deposit"
            ? "The deposit payment was recorded, the booking calendar was updated and the deposit receipt was sent."
            : "The balance payment was recorded, the booking calendar was updated and the balance receipt was sent.",
      },
      {
        status:
          followUpRequired
            ? 207
            : 200,
      }
    );
  } catch (error) {
    console.error(
      "Booking payment recording failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to record the booking payment.",
      },
      {
        status: 500,
      }
    );
  }
}