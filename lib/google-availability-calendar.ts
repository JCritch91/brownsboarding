type GoogleAvailabilityEvent = {
  date: string;
  available: boolean;
  totalSpaces: number;
  spacesAvailable: number;
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

function getAvailabilityCalendarId() {
  const calendarId = process.env.GOOGLE_AVAILABILITY_CALENDAR_ID;

  if (!calendarId) {
    throw new Error("GOOGLE_AVAILABILITY_CALENDAR_ID is missing.");
  }

  return calendarId;
}

function addOneDay(dateString: string) {
  const date = new Date(`${dateString}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() + 1);

  return date.toISOString().split("T")[0];
}

function getAvailabilityStatus(event: GoogleAvailabilityEvent) {
  if (!event.available) {
    return {
      summary: "Unavailable",
      status: "Unavailable",
      colorId: "11",
    };
  }

  if (event.spacesAvailable <= 0) {
    return {
      summary: "Fully Booked",
      status: "Fully booked",
      colorId: "11",
    };
  }

  if (event.spacesAvailable < event.totalSpaces) {
    return {
      summary: `${event.spacesAvailable} Space${
        event.spacesAvailable === 1 ? "" : "s"
      } Available`,
      status: "Limited availability",
      colorId: "5",
    };
  }

  return {
    summary: `${event.spacesAvailable} Space${
      event.spacesAvailable === 1 ? "" : "s"
    } Available`,
    status: "Available",
    colorId: "10",
  };
}

function createAvailabilityEventBody(event: GoogleAvailabilityEvent) {
  const availabilityStatus = getAvailabilityStatus(event);

  const description = [
    `Status: ${availabilityStatus.status}`,
    `Total spaces: ${event.totalSpaces}`,
    `Spaces available: ${event.spacesAvailable}`,
    "",
    "Admin notes:",
    event.notes || "None",
  ].join("\n");

  return {
    summary: availabilityStatus.summary,
    description,
    start: {
      date: event.date,
    },
    end: {
      date: addOneDay(event.date),
    },
    colorId: availabilityStatus.colorId,
    transparency: "transparent",
  };
}

export async function createGoogleAvailabilityEvent(
  event: GoogleAvailabilityEvent
) {
  const accessToken = await getGoogleAccessToken();
  const calendarId = getAvailabilityCalendarId();

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
      body: JSON.stringify(createAvailabilityEventBody(event)),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
        "Unable to create Google availability event."
    );
  }

  return data;
}

export async function updateGoogleAvailabilityEvent(
  googleEventId: string,
  event: GoogleAvailabilityEvent
) {
  const accessToken = await getGoogleAccessToken();
  const calendarId = getAvailabilityCalendarId();

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
      body: JSON.stringify(createAvailabilityEventBody(event)),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
        "Unable to update Google availability event."
    );
  }

  return data;
}