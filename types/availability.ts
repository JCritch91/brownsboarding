export type Availability = {
  id: string;
  date: string;
  available: boolean;
  total_spaces: number;
  spaces_available: number;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AvailabilityCalendarFailure = {
  date: string;
  error: string;
};
