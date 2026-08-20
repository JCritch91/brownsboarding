export function formatMoney(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return "";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

export function formatDisplayDate(dateString: string) {
  if (!dateString) return "";

  const [year, month, day] = dateString.split("-");

  return `${day}/${month}/${year}`;
}

export function formatDateForDatabase(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatAddressLine(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (/^\d+[a-z]?$/.test(word)) {
        return word.toUpperCase();
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export function formatPostcode(value: string) {
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, "");

  if (cleaned.length <= 3) {
    return cleaned;
  }

  return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`;
}

export function formatEmail(value: string) {
  return value.trim().toLowerCase();
}

export function formatUkPhone(value: string) {
  const cleaned = value.replace(/\s+/g, "").trim();

  if (cleaned.startsWith("+44")) {
    const withoutPrefix = cleaned.replace("+44", "0");

    return `${withoutPrefix.slice(0, 5)} ${withoutPrefix.slice(
      5,
      8,
    )} ${withoutPrefix.slice(8)}`;
  }

  if (cleaned.startsWith("07") && cleaned.length === 11) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
  }

  return value.trim();
}

export function getDatesInRange(start: string, end: string) {
  const dates: string[] = [];

  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);

  const currentDate = new Date(startYear, startMonth - 1, startDay);
  const finalDate = new Date(endYear, endMonth - 1, endDay);

  while (currentDate <= finalDate) {
    dates.push(formatDateForDatabase(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
}

export function calculateNumberOfNights(start: string, end: string) {
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);

  const startDateObject = new Date(startYear, startMonth - 1, startDay);
  const endDateObject = new Date(endYear, endMonth - 1, endDay);

  const differenceMs = endDateObject.getTime() - startDateObject.getTime();

  return Math.max(1, Math.ceil(differenceMs / (1000 * 60 * 60 * 24)));
}

export function isWithinTwoWeeks(startDate: string) {
  const [year, month, day] = startDate.split("-").map(Number);

  const arrivalDate = new Date(year, month - 1, day);
  arrivalDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const fourteenDaysFromNow = new Date(today);
  fourteenDaysFromNow.setDate(today.getDate() + 14);

  return arrivalDate <= fourteenDaysFromNow;
}

type DogValidationForm = {
  date_of_birth: string;
  vaccinated: string;
  vaccination_expiry: string;
};

export function validateDogDetails(form: DogValidationForm) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (form.date_of_birth) {
    const dateOfBirth = new Date(form.date_of_birth);
    dateOfBirth.setHours(0, 0, 0, 0);

    const minimumAgeDate = new Date(today);
    minimumAgeDate.setDate(minimumAgeDate.getDate() - 16 * 7);

    if (dateOfBirth > minimumAgeDate) {
      return "Dogs must be at least 16 weeks old before they can be added.";
    }
  }

  if (form.vaccinated === "yes") {
    if (!form.vaccination_expiry) {
      return "Please enter the vaccination expiry date.";
    }

    const vaccinationExpiryDate = new Date(form.vaccination_expiry);
    vaccinationExpiryDate.setHours(0, 0, 0, 0);

    const oneYearFromToday = new Date(today);
    oneYearFromToday.setFullYear(oneYearFromToday.getFullYear() + 1);

    if (vaccinationExpiryDate <= today) {
      return "Vaccination expiry date must be in the future.";
    }

    if (vaccinationExpiryDate > oneYearFromToday) {
      return "Vaccination expiry date cannot be more than 12 months in the future.";
    }
  }

  return "";
}

export function validateBookingDates(startDate: string, endDate: string) {
  if (!startDate) {
    return "Please select an arrival date.";
  }

  if (!endDate) {
    return "Please select a departure date.";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const arrivalDate = new Date(startDate);
  arrivalDate.setHours(0, 0, 0, 0);

  const departureDate = new Date(endDate);
  departureDate.setHours(0, 0, 0, 0);

  if (arrivalDate < today) {
    return "Arrival date cannot be in the past.";
  }

  if (departureDate <= arrivalDate) {
    return "Departure date must be at least one day after the arrival date.";
  }

  return "";
}

export function getTodayForDateInput() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
