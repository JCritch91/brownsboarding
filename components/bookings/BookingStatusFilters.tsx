import { BOOKING_STATUSES, type BookingFilter } from "@/types/booking";

type BookingStatusFiltersProps = {
  selectedFilter: BookingFilter;
  onFilterChange: (filter: BookingFilter) => void;
};

export default function BookingStatusFilters({
  selectedFilter,
  onFilterChange,
}: BookingStatusFiltersProps) {
  const filters: BookingFilter[] = ["All", ...BOOKING_STATUSES];

  return (
    <div className="mt-5 flex flex-wrap gap-2 md:mt-8 md:gap-3">
      {filters.map((filter) => (
        <button
          key={filter}
          type="button"
          onClick={() => onFilterChange(filter)}
          className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-300 md:px-4 md:py-2 md:text-base ${
            selectedFilter === filter
              ? "bg-[#8B6A4E] text-white"
              : "border border-[#D9CBB8] bg-white text-[#8B6A4E] hover:bg-[#F5EFE6]"
          }`}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}
