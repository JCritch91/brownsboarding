export type Dog = {
  id: string;
  owner_id: string;
  name: string;
  breed: string | null;
  date_of_birth: string | null;
  weight_kg: number | null;
  gender: string | null;
  neutered: boolean | null;
  vaccinated: boolean | null;
  vaccination_expiry: string | null;
  vet_name: string | null;
  vet_phone: string | null;
  vet_address: string | null;
  medical_notes: string | null;
  medication_notes: string | null;
  feeding_notes: string | null;
  behaviour_notes: string | null;
  meet_and_greet_completed: boolean | null;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DogSummary = Pick<
  Dog,
  | "id"
  | "name"
  | "breed"
  | "active"
  | "vaccinated"
  | "vaccination_expiry"
  | "meet_and_greet_completed"
>;
