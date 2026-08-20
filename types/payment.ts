export type PaymentType = "Deposit" | "Balance";

export type Payment = {
  id: string;
  invoice_number: string;
  booking_id: string;
  owner_id: string;
  dog_id: string;
  amount: number;
  payment_type: PaymentType;
  payment_date: string;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
