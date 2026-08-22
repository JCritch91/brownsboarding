import { formatDisplayDate, formatName } from "@/lib/helpers";

import AdminBookingActions from "@/components/bookings/AdminBookingActions";
import BookingPricingPanel from "@/components/bookings/BookingPricingPanel";

import type { BookingWithCustomer } from "@/types/booking";

type AdminBookingCardProps = {
  booking: BookingWithCustomer;

  onConfirmAvailability: (booking: BookingWithCustomer) => void | Promise<void>;

  onConfirm: (booking: BookingWithCustomer) => void | Promise<void>;

  onCancel: (booking: BookingWithCustomer) => void | Promise<void>;

  onMarkDepositPaid: (booking: BookingWithCustomer) => void | Promise<void>;

  onMarkBalancePaid: (booking: BookingWithCustomer) => void | Promise<void>;
};

function getBookingDogs(booking: BookingWithCustomer) {
  const linkedDogs = (booking.booking_dogs || [])
    .slice()
    .sort(
      (firstLink, secondLink) => firstLink.sort_order - secondLink.sort_order,
    )
    .map((bookingDog) => bookingDog.dogs)
    .filter((dog): dog is NonNullable<typeof dog> => dog !== null);

  if (linkedDogs.length > 0) {
    return linkedDogs;
  }

  return booking.dogs ? [booking.dogs] : [];
}

function getDogNames(booking: BookingWithCustomer) {
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

function getDogBreeds(booking: BookingWithCustomer) {
  return getBookingDogs(booking)
    .map((dog) => (dog.breed ? formatName(dog.breed) : ""))
    .filter(Boolean)
    .join(", ");
}

function getCustomerName(booking: BookingWithCustomer) {
  const firstName = booking.customer?.first_name || "";

  const lastName = booking.customer?.last_name || "";

  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || booking.customer?.email || "Customer";
}

export default function AdminBookingCard({
  booking,
  onConfirmAvailability,
  onConfirm,
  onCancel,
  onMarkDepositPaid,
  onMarkBalancePaid,
}: AdminBookingCardProps) {
  const dogNames = getDogNames(booking);
  const dogBreeds = getDogBreeds(booking);
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

          <p className="mt-1 text-sm text-[#8B6A4E] md:text-base">
            Household space allocation: {booking.space_units} space
            {booking.space_units === 1 ? "" : "s"}
          </p>

          <p className="mt-2 text-sm text-[#8B6A4E] md:mt-3 md:text-base">
            Customer: {getCustomerName(booking)}
          </p>

          {booking.customer?.email && (
            <p className="mt-1 break-all text-sm text-[#8B6A4E] md:text-base">
              Email: {booking.customer.email}
            </p>
          )}

          {booking.availability_confirmation_required && (
            <div
              className={`mt-4 rounded-lg border p-3 ${
                booking.availability_confirmed_at
                  ? "border-green-300 bg-green-50 text-green-800"
                  : "border-amber-300 bg-amber-50 text-amber-800"
              }`}
            >
              {booking.availability_confirmed_at ? (
                <>
                  <p className="font-semibold">Availability confirmed</p>

                  <p className="mt-1 text-sm">
                    Unconfigured availability was reviewed and approved for this
                    booking.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">Availability review required</p>

                  <p className="mt-1 text-sm">
                    Availability had not been configured for one or more
                    selected dates when this request was submitted.
                  </p>

                  <button
                    type="button"
                    onClick={() => onConfirmAvailability(booking)}
                    className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg border border-amber-500 bg-white px-4 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                  >
                    Confirm Availability
                  </button>
                </>
              )}
            </div>
          )}

          <BookingPricingPanel booking={booking} />

          {booking.notes && (
            <p className="mt-2 text-sm text-[#8B6A4E] md:mt-3 md:text-base">
              Notes: {booking.notes}
            </p>
          )}
        </div>

        <AdminBookingActions
          booking={booking}
          onConfirm={(selectedBooking) => {
            if (
              selectedBooking.availability_confirmation_required &&
              !selectedBooking.availability_confirmed_at
            ) {
              return;
            }

            return onConfirm(selectedBooking);
          }}
          onCancel={onCancel}
          onMarkDepositPaid={onMarkDepositPaid}
          onMarkBalancePaid={onMarkBalancePaid}
        />
      </div>
    </div>
  );
}
