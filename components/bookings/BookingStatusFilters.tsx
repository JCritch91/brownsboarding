import type { BookingFilter } from "@/types/booking";

type BookingStatusFiltersProps = {
  selectedFilter: BookingFilter;
  onFilterChange: (filter: BookingFilter) => void;
};

const bookingFilterOptions: Array<{
  value: BookingFilter;
  label: string;
}> = [
  {
    value: "Live",
    label: "Live Bookings",
  },
  {
    value: "All",
    label: "All Bookings",
  },
  {
    value: "Pending",
    label: "Pending",
  },
  {
    value: "Deposit Pending",
    label: "Deposit Pending",
  },
  {
    value: "Balance Pending",
    label: "Balance Pending",
  },
  {
    value: "Balance Paid",
    label: "Balance Paid",
  },
  {
    value: "Completed",
    label: "Completed",
  },
  {
    value: "Cancelled",
    label: "Cancelled",
  },
];

export default function BookingStatusFilters({
  selectedFilter,
  onFilterChange,
}: BookingStatusFiltersProps) {
  return (
    <div className="mt-6 max-w-sm md:mt-8">
      <label
        htmlFor="bookingStatusFilter"
        className="mb-2 block text-sm font-medium text-[#5C4033] md:text-base"
      >
        Filter bookings
      </label>

      <select
        id="bookingStatusFilter"
        value={selectedFilter}
        onChange={(event) =>
          onFilterChange(event.target.value as BookingFilter)
        }
        className="min-h-11 w-full rounded-lg border border-[#D9CBB8] bg-white px-3 py-2 text-sm text-[#5C4033] outline-none transition-colors focus:border-[#8B6A4E] focus:ring-2 focus:ring-[#8B6A4E]/20 md:text-base"
      >
        {bookingFilterOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
