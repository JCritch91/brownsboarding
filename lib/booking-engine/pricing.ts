import type {
  BookingStatus,
  BookingType,
  DaycareSessionType,
} from "@/types/booking";

export type BookingPriceUnit =
  "boarding_night" | "daycare_full_day" | "daycare_half_day";

export type BookingEnginePricingSettings = {
  id: string;
  nightly_rate: number;
  deposit_percentage: number;
  daycare_full_day_rate: number;
  daycare_half_day_rate: number;
  daycare_deposit_percentage: number;
  effective_from: string;
  active: boolean;
};

export type BookingPricingInput = {
  bookingType: BookingType;
  daycareSession: DaycareSessionType | null;
  startDate: string;
  endDate: string;
  pricing: BookingEnginePricingSettings;
  today?: string;
};

export type BookingPricingResult = {
  pricingSettingId: string;
  bookingType: BookingType;
  daycareSession: DaycareSessionType | null;
  priceUnit: BookingPriceUnit;
  unitRate: number;
  quantity: number;
  depositPercentage: number;
  totalCost: number;
  depositAmount: number;
  balanceAmount: number;
  shortNoticeBooking: boolean;
  newStatus: Extract<BookingStatus, "Deposit Pending" | "Balance Pending">;

  /**
   * Retained for compatibility with existing Boarding
   * payload builders and booking displays.
   */
  numberOfNights: number;
  nightlyRate: number | null;
};

const DATABASE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isValidDatabaseDate(value: string) {
  if (!DATABASE_DATE_PATTERN.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === value
  );
}

function getCurrentDatabaseDate() {
  return new Date().toISOString().slice(0, 10);
}

function getDifferenceInDays(startDate: string, endDate: string) {
  const startDateValue = new Date(`${startDate}T00:00:00Z`);

  const endDateValue = new Date(`${endDate}T00:00:00Z`);

  return Math.round(
    (endDateValue.getTime() - startDateValue.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function isShortNoticeBooking({
  startDate,
  today = getCurrentDatabaseDate(),
}: {
  startDate: string;
  today?: string;
}) {
  if (!isValidDatabaseDate(startDate) || !isValidDatabaseDate(today)) {
    throw new Error(
      "Short-notice pricing requires valid booking and current dates.",
    );
  }

  const daysUntilStart = getDifferenceInDays(today, startDate);

  return daysUntilStart <= 14;
}

function validateRate(rate: number, label: string) {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }

  return roundMoney(rate);
}

function validateDepositPercentage(percentage: number, label: string) {
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new Error(`${label} must be between 0 and 100.`);
  }

  return roundMoney(percentage);
}

function getBoardingQuantity({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  if (!isValidDatabaseDate(startDate) || !isValidDatabaseDate(endDate)) {
    throw new Error("Boarding pricing requires valid start and end dates.");
  }

  const numberOfNights = getDifferenceInDays(startDate, endDate);

  if (numberOfNights < 1) {
    throw new Error("A boarding booking must contain at least one night.");
  }

  return numberOfNights;
}

function validateDaycareDates({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  if (!isValidDatabaseDate(startDate) || !isValidDatabaseDate(endDate)) {
    throw new Error("Daycare pricing requires a valid attendance date.");
  }

  if (startDate !== endDate) {
    throw new Error("A daycare booking must start and end on the same date.");
  }
}

function calculateAmounts({
  quantity,
  unitRate,
  depositPercentage,
  shortNoticeBooking,
}: {
  quantity: number;
  unitRate: number;
  depositPercentage: number;
  shortNoticeBooking: boolean;
}) {
  const totalCost = roundMoney(quantity * unitRate);

  const depositAmount = shortNoticeBooking
    ? 0
    : roundMoney(totalCost * (depositPercentage / 100));

  const balanceAmount = roundMoney(totalCost - depositAmount);

  return {
    totalCost,
    depositAmount,
    balanceAmount,
    newStatus: shortNoticeBooking
      ? ("Balance Pending" as const)
      : ("Deposit Pending" as const),
  };
}

export function calculateBookingEnginePricing({
  bookingType,
  daycareSession,
  startDate,
  endDate,
  pricing,
  today,
}: BookingPricingInput): BookingPricingResult {
  const shortNoticeBooking = isShortNoticeBooking({
    startDate,
    today,
  });

  if (bookingType === "boarding") {
    if (daycareSession !== null) {
      throw new Error("A daycare session cannot be priced as Boarding.");
    }

    const quantity = getBoardingQuantity({
      startDate,
      endDate,
    });

    const unitRate = validateRate(
      Number(pricing.nightly_rate),
      "The boarding nightly rate",
    );

    const depositPercentage = validateDepositPercentage(
      Number(pricing.deposit_percentage),
      "The boarding deposit percentage",
    );

    const amounts = calculateAmounts({
      quantity,
      unitRate,
      depositPercentage,
      shortNoticeBooking,
    });

    return {
      pricingSettingId: pricing.id,
      bookingType,
      daycareSession: null,
      priceUnit: "boarding_night",
      unitRate,
      quantity,
      depositPercentage,
      ...amounts,
      shortNoticeBooking,
      numberOfNights: quantity,
      nightlyRate: unitRate,
    };
  }

  validateDaycareDates({
    startDate,
    endDate,
  });

  const depositPercentage = validateDepositPercentage(
    Number(pricing.daycare_deposit_percentage),
    "The daycare deposit percentage",
  );

  if (daycareSession === "full_day") {
    const unitRate = validateRate(
      Number(pricing.daycare_full_day_rate),
      "The daycare full-day rate",
    );

    const amounts = calculateAmounts({
      quantity: 1,
      unitRate,
      depositPercentage,
      shortNoticeBooking,
    });

    return {
      pricingSettingId: pricing.id,
      bookingType,
      daycareSession,
      priceUnit: "daycare_full_day",
      unitRate,
      quantity: 1,
      depositPercentage,
      ...amounts,
      shortNoticeBooking,
      numberOfNights: 0,
      nightlyRate: null,
    };
  }

  if (daycareSession === "half_day") {
    const unitRate = validateRate(
      Number(pricing.daycare_half_day_rate),
      "The daycare half-day rate",
    );

    const amounts = calculateAmounts({
      quantity: 1,
      unitRate,
      depositPercentage,
      shortNoticeBooking,
    });

    return {
      pricingSettingId: pricing.id,
      bookingType,
      daycareSession,
      priceUnit: "daycare_half_day",
      unitRate,
      quantity: 1,
      depositPercentage,
      ...amounts,
      shortNoticeBooking,
      numberOfNights: 0,
      nightlyRate: null,
    };
  }

  throw new Error("Please select a full-day or half-day daycare session.");
}
