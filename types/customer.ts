export type CustomerProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;

  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  postcode: string | null;

  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;

  active: boolean;
  was_activated: boolean;
  activation_token: string | null;
  activated_at: string | null;
  created_at: string | null;

  is_admin: boolean | null;
};

export type CustomerSummary = Pick<
  CustomerProfile,
  "id" | "first_name" | "last_name" | "email" | "active" | "is_admin"
>;
