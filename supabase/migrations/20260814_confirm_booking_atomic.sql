create or replace function public.confirm_booking_atomic(
  p_booking_id uuid,
  p_pricing_setting_id uuid,
  p_nightly_rate numeric,
  p_number_of_nights integer,
  p_total_cost numeric,
  p_deposit_amount numeric,
  p_balance_amount numeric,
  p_new_status text
)
returns table (
  booking_id uuid,
  booking_reference text,
  previous_status text,
  new_status text,
  start_date date,
  end_date date
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_required_dates integer;
  v_available_dates integer;
begin
  /*
   * Lock the booking row so it cannot be confirmed
   * simultaneously by two requests.
   */
  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if v_booking.status <> 'Pending' then
    raise exception
      'BOOKING_NOT_PENDING: Current status is %',
      v_booking.status;
  end if;

  if v_booking.end_date <= v_booking.start_date then
    raise exception 'INVALID_BOOKING_DATES';
  end if;

  if p_new_status not in (
    'Deposit Pending',
    'Balance Pending'
  ) then
    raise exception 'INVALID_CONFIRMATION_STATUS';
  end if;

  if p_number_of_nights <= 0 then
    raise exception 'INVALID_NUMBER_OF_NIGHTS';
  end if;

  if p_nightly_rate < 0 then
    raise exception 'INVALID_NIGHTLY_RATE';
  end if;

  if p_total_cost < 0 then
    raise exception 'INVALID_TOTAL_COST';
  end if;

  if p_deposit_amount < 0 then
    raise exception 'INVALID_DEPOSIT_AMOUNT';
  end if;

  if p_balance_amount < 0 then
    raise exception 'INVALID_BALANCE_AMOUNT';
  end if;

  if p_deposit_amount + p_balance_amount <> p_total_cost then
    raise exception 'INVALID_PAYMENT_TOTALS';
  end if;

  /*
   * The departure date does not consume a boarding
   * space, so the required date count is end - start.
   */
  v_required_dates :=
    v_booking.end_date - v_booking.start_date;

  /*
   * Lock all affected availability records.
   * The locks remain in place until the transaction ends.
   */
  perform id
  from public.availability
  where date >= v_booking.start_date
    and date < v_booking.end_date
  order by date
  for update;

  select count(*)
  into v_available_dates
  from public.availability
  where date >= v_booking.start_date
    and date < v_booking.end_date
    and available = true
    and spaces_available > 0;

  if v_available_dates <> v_required_dates then
    raise exception
      'INSUFFICIENT_AVAILABILITY: Required %, available %',
      v_required_dates,
      v_available_dates;
  end if;

  /*
   * Reduce availability for every occupied night.
   */
  update public.availability
  set
    spaces_available = spaces_available - 1,
    updated_at = now()
  where date >= v_booking.start_date
    and date < v_booking.end_date
    and available = true
    and spaces_available > 0;

  if not found then
    raise exception 'AVAILABILITY_UPDATE_FAILED';
  end if;

  /*
   * Save the pricing snapshot and confirm the booking.
   */
  update public.bookings
  set
    status = p_new_status,
    pricing_setting_id = p_pricing_setting_id,
    nightly_rate = p_nightly_rate,
    number_of_nights = p_number_of_nights,
    total_cost = p_total_cost,
    deposit_amount = p_deposit_amount,
    balance_amount = p_balance_amount,
    updated_at = now()
  where id = p_booking_id
    and status = 'Pending';

  if not found then
    raise exception 'BOOKING_UPDATE_FAILED';
  end if;

  return query
  select
    v_booking.id,
    v_booking.booking_reference,
    v_booking.status,
    p_new_status,
    v_booking.start_date,
    v_booking.end_date;
end;
$$;



revoke all on function public.confirm_booking_atomic(
  uuid,
  uuid,
  numeric,
  integer,
  numeric,
  numeric,
  numeric,
  text
) from public;

revoke all on function public.confirm_booking_atomic(
  uuid,
  uuid,
  numeric,
  integer,
  numeric,
  numeric,
  numeric,
  text
) from anon;

revoke all on function public.confirm_booking_atomic(
  uuid,
  uuid,
  numeric,
  integer,
  numeric,
  numeric,
  numeric,
  text
) from authenticated;

grant execute on function public.confirm_booking_atomic(
  uuid,
  uuid,
  numeric,
  integer,
  numeric,
  numeric,
  numeric,
  text
) to service_role;