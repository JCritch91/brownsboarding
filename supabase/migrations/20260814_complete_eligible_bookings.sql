create or replace function public.complete_eligible_bookings()
returns table (
  booking_id uuid,
  booking_reference text,
  owner_id uuid,
  dog_id uuid,
  start_date date,
  end_date date,
  previous_status text,
  new_status text,
  notes text,
  total_cost numeric,
  deposit_amount numeric,
  balance_amount numeric
)
language plpgsql
security invoker
set search_path = public
as $$
begin
  /*
   * Complete every fully paid booking whose stay
   * ended before today.
   *
   * The conditional status check prevents a booking
   * that has changed state from being completed.
   */
  return query
  update public.bookings as booking
  set
    status = 'Completed',
    updated_at = now()
  where booking.status = 'Balance Paid'
    and booking.end_date < current_date
  returning
    booking.id,
    booking.booking_reference,
    booking.owner_id,
    booking.dog_id,
    booking.start_date,
    booking.end_date,
    'Balance Paid'::text,
    booking.status,
    booking.notes,
    booking.total_cost,
    booking.deposit_amount,
    booking.balance_amount;
end;
$$;

revoke all on function public.complete_eligible_bookings()
from public;

revoke all on function public.complete_eligible_bookings()
from anon;

revoke all on function public.complete_eligible_bookings()
from authenticated;

grant execute on function public.complete_eligible_bookings()
to service_role;