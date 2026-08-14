import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  formatMoney,
  formatName,
} from "@/lib/helpers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type CompletedBooking = {
  booking_id: string;
  booking_reference: string;
  owner_id: string;
  dog_id: string;
  start_date: string;
  end_date: string;
  previous_status: string;
  new_status: string;
  notes: string | null;
  total_cost: number | null;
  deposit_amount: number | null;
  balance_amount: number | null;
};

type CustomerProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type DogDetails = {
  id: string;
  name: string;
  breed: string | null;
};

type CalendarFailure = {
  bookingId: string;
  bookingReference: string;
  error: string;
};

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
      authorizationHeader?.replace(
        "Bearer ",
        ""
      );

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
            "You do not have permission to complete bookings.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * Complete every eligible booking in one database
     * operation and return the bookings that changed.
     */
    const {
      data: completionRows,
      error: completionError,
    } = await supabaseAdmin.rpc(
      "complete_eligible_bookings"
    );

    if (completionError) {
      console.error(
        "Eligible booking completion failed:",
        completionError
      );

      return NextResponse.json(
        {
          error:
            completionError.message ||
            "Eligible bookings could not be completed.",
        },
        {
          status: 500,
        }
      );
    }

    const completedBookings =
      (completionRows || []) as CompletedBooking[];

    /*
     * No eligible bookings is a successful no-op.
     */
    if (completedBookings.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        completed: 0,
        calendarUpdated: 0,
        calendarFailures: [],
        followUpRequired: false,
        message:
          "There were no eligible bookings to complete.",
      });
    }

    const ownerIds = Array.from(
      new Set(
        completedBookings.map(
          (booking) => booking.owner_id
        )
      )
    );

    const dogIds = Array.from(
      new Set(
        completedBookings.map(
          (booking) => booking.dog_id
        )
      )
    );

    const [
      {
        data: customerData,
        error: customerLoadError,
      },
      {
        data: dogData,
        error: dogLoadError,
      },
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          `
          id,
          first_name,
          last_name,
          email
          `
        )
        .in("id", ownerIds),

      supabaseAdmin
        .from("dogs")
        .select(
          `
          id,
          name,
          breed
          `
        )
        .in("id", dogIds),
    ]);

    if (customerLoadError) {
      return NextResponse.json(
        {
          success: true,
          databaseCompleted: true,
          processed:
            completedBookings.length,
          completed:
            completedBookings.length,
          followUpRequired: true,
          error:
            `Bookings were completed, but customer details could not be loaded: ${customerLoadError.message}`,
        },
        {
          status: 207,
        }
      );
    }

    if (dogLoadError) {
      return NextResponse.json(
        {
          success: true,
          databaseCompleted: true,
          processed:
            completedBookings.length,
          completed:
            completedBookings.length,
          followUpRequired: true,
          error:
            `Bookings were completed, but dog details could not be loaded: ${dogLoadError.message}`,
        },
        {
          status: 207,
        }
      );
    }

    const customers =
      (customerData || []) as CustomerProfile[];

    const dogs =
      (dogData || []) as DogDetails[];

    const customerById = new Map(
      customers.map((customer) => [
        customer.id,
        customer,
      ])
    );

    const dogById = new Map(
      dogs.map((dog) => [
        dog.id,
        dog,
      ])
    );

    const requestOrigin =
      new URL(request.url).origin;

    /*
     * Each booking calendar update is independent,
     * so complete all Google Calendar operations
     * concurrently.
     */
    const calendarResults =
      await Promise.allSettled(
        completedBookings.map(
          async (booking) => {
            const customer =
              customerById.get(
                booking.owner_id
              );

            const dog =
              dogById.get(
                booking.dog_id
              );

            if (!customer) {
              throw new Error(
                "Customer details could not be found."
              );
            }

            if (!dog) {
              throw new Error(
                "Dog details could not be found."
              );
            }

            const customerName =
              `${customer.first_name || ""} ${
                customer.last_name || ""
              }`.trim() ||
              customer.email ||
              "Customer";

            const response = await fetch(
              `${requestOrigin}/api/google/update-booking-event`,
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  bookingId:
                    booking.booking_id,
                  bookingReference:
                    booking.booking_reference,
                  ownerName:
                    customerName,
                  ownerEmail:
                    customer.email || null,
                  dogName:
                    formatName(
                      dog.name || ""
                    ) || "Dog",
                  dogBreed:
                    dog.breed
                      ? formatName(dog.breed)
                      : null,
                  startDate:
                    booking.start_date,
                  endDate:
                    booking.end_date,
                  bookingStatus:
                    "Completed",
                  paymentStatus:
                    "Fully paid",
                  totalCost:
                    formatMoney(
                      Number(
                        booking.total_cost || 0
                      )
                    ),
                  depositAmount:
                    formatMoney(
                      Number(
                        booking.deposit_amount ||
                          0
                      )
                    ),
                  balanceAmount:
                    formatMoney(
                      Number(
                        booking.balance_amount ||
                          0
                      )
                    ),
                  notes:
                    booking.notes,
                }),
              }
            );

            if (!response.ok) {
              throw new Error(
                await getResponseError(
                  response,
                  "The Google booking calendar could not be updated."
                )
              );
            }

            return booking.booking_id;
          }
        )
      );

    const calendarFailures:
      CalendarFailure[] = [];

    let calendarUpdated = 0;

    calendarResults.forEach(
      (calendarResult, index) => {
        const booking =
          completedBookings[index];

        if (
          calendarResult.status ===
          "fulfilled"
        ) {
          calendarUpdated += 1;
          return;
        }

        const errorMessage =
          calendarResult.reason instanceof Error
            ? calendarResult.reason.message
            : "Unknown Google Calendar error.";

        calendarFailures.push({
          bookingId:
            booking.booking_id,
          bookingReference:
            booking.booking_reference,
          error:
            errorMessage,
        });

        console.error(
          `Google Calendar completion update failed for ${booking.booking_reference}:`,
          calendarResult.reason
        );
      }
    );

    const followUpRequired =
      calendarFailures.length > 0;

    return NextResponse.json(
      {
        success: true,
        databaseCompleted: true,
        processed:
          completedBookings.length,
        completed:
          completedBookings.length,
        calendarUpdated,
        calendarFailures,
        followUpRequired,

        bookings:
          completedBookings.map(
            (booking) => ({
              id:
                booking.booking_id,
              bookingReference:
                booking.booking_reference,
              previousStatus:
                booking.previous_status,
              newStatus:
                booking.new_status,
              startDate:
                booking.start_date,
              endDate:
                booking.end_date,
            })
          ),

        message: followUpRequired
          ? `${completedBookings.length} booking(s) were completed, but ${calendarFailures.length} Google Calendar event(s) could not be updated.`
          : `${completedBookings.length} booking(s) were completed and their Google Calendar events were updated.`,
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
      "Automatic booking completion failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete eligible bookings.",
      },
      {
        status: 500,
      }
    );
  }
}