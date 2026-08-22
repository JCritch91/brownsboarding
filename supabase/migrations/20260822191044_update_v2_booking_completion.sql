drop function if exists public.complete_eligible_bookings();

create or replace function public.complete_eligible_bookings()
returns table (
  booking_id uuid,
  booking_reference text,
  owner_id uuid,
  dog_id uuid,
  booking_type public.booking_type,
  daycare_session public.daycare_session_type,
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
security definer
set search_path = public
as $$
begin
  /*
   * Boarding bookings complete once the departure date
   * has passed.
   *
   * Same-day Doggy Day Care bookings complete once the
   * attendance date has passed.
   */
  return query
  update public.bookings as booking
  set
    status = 'Completed',
    updated_at = now()
  where booking.status = 'Balance Paid'
    and (
      (
        booking.booking_type = 'boarding'
        and booking.end_date < current_date
      )
      or
      (
        booking.booking_type = 'daycare'
        and booking.start_date < current_date
      )
    )
  returning
    booking.id,
    booking.booking_reference,
    booking.owner_id,
    booking.dog_id,
    booking.booking_type,
    booking.daycare_session,
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

revoke all
on function public.complete_eligible_bookings()
from public;

grant execute
on function public.complete_eligible_bookings()
to postgres, service_role;

comment on function public.complete_eligible_bookings() is
  'Completes fully paid Boarding bookings after departure and Doggy Day Care bookings after the attendance date.';