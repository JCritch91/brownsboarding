type GoogleCalendarBookingEvent = {
  bookingId: string;
  bookingReference: string;
  ownerName: string;
  ownerEmail?: string | null;
  dogName: string;
  dogBreed?: string | null;
  startDate: string;
  endDate: string;
  bookingStatus: string;
  paymentStatus: string;
  totalCost?: string | null;
  depositAmount?: string | null;
  balanceAmount?: string | null;
  notes?: string | null;
};

async function getGoogleAccessToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Calendar environment variables are missing.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error_description ||
        data.error ||
        "Unable to get Google access token."
    );
  }

  return data.access_token as string;
}

function getCalendarId() {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!calendarId) {
    throw new Error("GOOGLE_CALENDAR_ID is missing.");
  }

  return calendarId;
}

function createEventDescription(booking: GoogleCalendarBookingEvent) {
  return [
    `Booking reference: ${booking.bookingReference}`,
    "",
    `Owner: ${booking.ownerName}`,
    `Owner email: ${booking.ownerEmail || "Not provided"}`,
    "",
    `Dog: ${booking.dogName}`,
    `Breed: ${booking.dogBreed || "Not provided"}`,
    "",
    `Booking status: ${booking.bookingStatus}`,
    `Payment status: ${booking.paymentStatus}`,
    "",
    `Total cost: ${booking.totalCost || "Not set"}`,
    `Deposit: ${booking.depositAmount || "Not set"}`,
    "",
    "Booking notes:",
    booking.notes || "None",
  ].join("\n");
}

function addOneDay(dateString: string) {
  const date = new Date(`${dateString}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() + 1);

  return date.toISOString().split("T")[0];
}

function createEventBody(booking: GoogleCalendarBookingEvent) {
  return {
    summary: `${booking.dogName} - ${booking.ownerName}`,
    description: createEventDescription(booking),
    start: {
      date: booking.startDate,
    },
    end: {
      date: addOneDay(booking.endDate),
    },
    colorId:
  booking.bookingStatus === "Cancelled"
    ? "11"
    : booking.bookingStatus === "Completed"
      ? "8"
      : "9",
    extendedProperties: {
      private: {
        bookingId: booking.bookingId,
      },
    },
  };
}

export async function createGoogleBookingEvent(
  booking: GoogleCalendarBookingEvent
) {
  const accessToken = await getGoogleAccessToken();
  const calendarId = getCalendarId();

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createEventBody(booking)),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message || "Unable to create Google Calendar event."
    );
  }

  return data;
}

export async function updateGoogleBookingEvent(
  googleEventId: string,
  booking: GoogleCalendarBookingEvent
) {
  const accessToken = await getGoogleAccessToken();
  const calendarId = getCalendarId();

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events/${encodeURIComponent(googleEventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createEventBody(booking)),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message || "Unable to update Google Calendar event."
    );
  }

  return data;
}