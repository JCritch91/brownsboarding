import { formatDisplayDate, formatName } from "@/lib/helpers";

import BookingStatusBadge from "@/components/bookings/BookingStatusBadge";
import CustomerBookingPricing from "@/components/bookings/CustomerBookingPricing";

import { CANCELLABLE_BOOKING_STATUSES, type Booking } from "@/types/booking";

type CustomerBookingCardProps = {
  booking: Booking;
  variant: "upcoming" | "historic";

  onCancel?: (booking: Booking) => void | Promise<void>;
};

function getBookingDogs(booking: Booking) {
  return (booking.booking_dogs || [])
    .slice()
    .sort(
      (firstLink, secondLink) => firstLink.sort_order - secondLink.sort_order,
    )
    .map((bookingDog) => bookingDog.dogs)
    .filter((dog): dog is NonNullable<typeof dog> => dog !== null);
}

function getDogNames(booking: Booking) {
  const dogNames = getBookingDogs(booking)
    .map((dog) => formatName(dog.name))
    .filter(Boolean);

  if (dogNames.length === 0) {
    return "Dog";
  }

  if (dogNames.length === 1) {
    return dogNames[0];
  }

  return `${dogNames[0]} and ${dogNames[1]}`;
}

function getDogBreeds(booking: Booking) {
  const breeds = getBookingDogs(booking)
    .map((dog) => (dog.breed ? formatName(dog.breed) : ""))
    .filter(Boolean);

  return breeds.join(", ");
}

export default function CustomerBookingCard({
  booking,
  variant,
  onCancel,
}: CustomerBookingCardProps) {
  const isUpcoming = variant === "upcoming";

  const dogNames = getDogNames(booking);
  const dogBreeds = getDogBreeds(booking);

  const canCancel =
    isUpcoming &&
    CANCELLABLE_BOOKING_STATUSES.includes(booking.status) &&
    Boolean(onCancel);

  return (
    <div className="rounded-xl border border-[#D9CBB8] bg-white p-4 shadow md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div>
          <h3 className="text-xl font-semibold text-[#5C4033] md:text-2xl">
            {dogNames}
          </h3>

          <p className="mt-1 text-xs font-semibold text-[#8B6A4E] md:text-sm">
            Booking reference: {booking.booking_reference}
          </p>

          {dogBreeds && (
            <p className="mt-1 text-sm text-[#8B6A4E] md:text-base">
              {dogBreeds}
            </p>
          )}

          <p className="mt-2 text-sm font-medium text-[#5C4033] md:mt-3 md:text-base">
            {booking.booking_type === "daycare" ? (
              <>
                Doggy Day Care
                {booking.daycare_session === "half_day"
                  ? ", Half Day"
                  : ", Full Day"}
                : {formatDisplayDate(booking.start_date)}
              </>
            ) : (
              <>
                Home Boarding: {formatDisplayDate(booking.start_date)} to{" "}
                {formatDisplayDate(booking.end_date)}
              </>
            )}
          </p>

          {booking.availability_confirmation_required &&
            !booking.availability_confirmed_at && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 md:text-base">
                <p className="font-semibold">
                  Availability awaiting confirmation
                </p>

                <p className="mt-1">
                  Availability had not been configured for one or more selected
                  dates. Browns Boarding will confirm whether this booking can
                  be accommodated.
                </p>
              </div>
            )}

          {isUpcoming && <CustomerBookingPricing booking={booking} />}

          {booking.notes && (
            <p className="mt-2 text-sm text-[#8B6A4E] md:mt-3 md:text-base">
              Notes: {booking.notes}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 md:flex-col md:items-end md:gap-3">
          <BookingStatusBadge booking={booking} />

          {canCancel && onCancel && (
            <button
              type="button"
              onClick={() => onCancel(booking)}
              className="inline-flex w-fit cursor-pointer items-center justify-center rounded-lg border border-red-400 px-3 py-1.5 text-xs font-semibold text-red-600 transition-all duration-300 hover:scale-105 hover:bg-red-50 md:px-4 md:py-2 md:text-base"
            >
              Cancel Booking
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
