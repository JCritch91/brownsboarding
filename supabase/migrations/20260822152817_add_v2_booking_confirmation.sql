create type public.booking_price_unit as enum (
  'boarding_night',
  'daycare_full_day',
  'daycare_half_day'
);

alter table public.bookings
  add column price_unit public.booking_price_unit,
  add column unit_rate numeric(10, 2),
  add column quantity integer,
  add column deposit_percentage_applied numeric(5, 2);

alter table public.bookings
  add constraint bookings_unit_rate_check
  check (
    unit_rate is null
    or unit_rate >= 0
  );

alter table public.bookings
  add constraint bookings_quantity_check
  check (
    quantity is null
    or quantity >= 1
  );

alter table public.bookings
  add constraint bookings_deposit_percentage_applied_check
  check (
    deposit_percentage_applied is null
    or (
      deposit_percentage_applied >= 0
      and deposit_percentage_applied <= 100
    )
  );

alter table public.bookings
  add constraint bookings_price_unit_service_check
  check (
    price_unit is null
    or (
      booking_type = 'boarding'
      and price_unit = 'boarding_night'
    )
    or (
      booking_type = 'daycare'
      and price_unit in (
        'daycare_full_day',
        'daycare_half_day'
      )
    )
  );

comment on column public.bookings.price_unit is
  'The service unit used to calculate the snapshotted booking price.';

comment on column public.bookings.unit_rate is
  'The price per service unit captured when the booking was confirmed.';

comment on column public.bookings.quantity is
  'The number of chargeable service units captured when the booking was confirmed.';

comment on column public.bookings.deposit_percentage_applied is
  'The deposit percentage captured from pricing settings when the booking was confirmed.';

update public.bookings
set
  price_unit = 'boarding_night',
  unit_rate = nightly_rate,
  quantity = number_of_nights,
  deposit_percentage_applied = case
    when total_cost is not null
      and total_cost > 0
      and deposit_amount is not null
    then round(
      (deposit_amount / total_cost) * 100,
      2
    )
    else null
  end
where
  booking_type = 'boarding'
  and pricing_setting_id is not null;

create or replace function public.confirm_booking_v2_atomic(
  p_booking_id uuid,
  p_pricing_setting_id uuid,
  p_price_unit public.booking_price_unit,
  p_unit_rate numeric,
  p_quantity integer,
  p_deposit_percentage numeric,
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
  booking_type public.booking_type,
  daycare_session public.daycare_session_type,
  start_date date,
  end_date date,
  price_unit public.booking_price_unit,
  unit_rate numeric,
  quantity integer,
  total_cost numeric,
  deposit_amount numeric,
  balance_amount numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_booking public.bookings%rowtype;
begin
  if p_booking_id is null then
    raise exception 'BOOKING_ID_REQUIRED';
  end if;

  if p_pricing_setting_id is null then
    raise exception 'PRICING_SETTING_REQUIRED';
  end if;

  if p_price_unit is null then
    raise exception 'PRICE_UNIT_REQUIRED';
  end if;

  if p_unit_rate is null or p_unit_rate < 0 then
    raise exception 'INVALID_UNIT_RATE';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'INVALID_QUANTITY';
  end if;

  if (
    p_deposit_percentage is null
    or p_deposit_percentage < 0
    or p_deposit_percentage > 100
  ) then
    raise exception 'INVALID_DEPOSIT_PERCENTAGE';
  end if;

  if p_total_cost is null or p_total_cost < 0 then
    raise exception 'INVALID_TOTAL_COST';
  end if;

  if p_deposit_amount is null or p_deposit_amount < 0 then
    raise exception 'INVALID_DEPOSIT_AMOUNT';
  end if;

  if p_balance_amount is null or p_balance_amount < 0 then
    raise exception 'INVALID_BALANCE_AMOUNT';
  end if;

  if round(
    p_deposit_amount + p_balance_amount,
    2
  ) <> round(p_total_cost, 2) then
    raise exception 'PRICING_TOTAL_MISMATCH';
  end if;

  if p_new_status not in (
    'Deposit Pending',
    'Balance Pending'
  ) then
    raise exception 'INVALID_CONFIRMATION_STATUS';
  end if;

  select *
  into selected_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if selected_booking.status <> 'Pending' then
    raise exception 'BOOKING_NOT_PENDING';
  end if;

  if (
    selected_booking.availability_confirmation_required
    and selected_booking.availability_confirmed_at is null
  ) then
    raise exception 'AVAILABILITY_REVIEW_REQUIRED';
  end if;

  if (
    selected_booking.booking_type = 'boarding'
    and p_price_unit <> 'boarding_night'
  ) then
    raise exception 'INVALID_BOARDING_PRICE_UNIT';
  end if;

  if (
    selected_booking.booking_type = 'daycare'
    and selected_booking.daycare_session = 'full_day'
    and p_price_unit <> 'daycare_full_day'
  ) then
    raise exception 'INVALID_DAYCARE_PRICE_UNIT';
  end if;

  if (
    selected_booking.booking_type = 'daycare'
    and selected_booking.daycare_session = 'half_day'
    and p_price_unit <> 'daycare_half_day'
  ) then
    raise exception 'INVALID_DAYCARE_PRICE_UNIT';
  end if;

  if (
    selected_booking.booking_type = 'daycare'
    and p_quantity <> 1
  ) then
    raise exception 'INVALID_DAYCARE_QUANTITY';
  end if;

  if (
    selected_booking.booking_type = 'boarding'
    and p_quantity <> (
      selected_booking.end_date
      - selected_booking.start_date
    )
  ) then
    raise exception 'INVALID_BOARDING_QUANTITY';
  end if;

  perform *
  from public.consume_booking_capacity_v2_atomic(
    selected_booking.id
  );

  update public.bookings
  set
    pricing_setting_id = p_pricing_setting_id,
    price_unit = p_price_unit,
    unit_rate = round(p_unit_rate, 2),
    quantity = p_quantity,
    deposit_percentage_applied = round(
      p_deposit_percentage,
      2
    ),
    total_cost = round(p_total_cost, 2),
    deposit_amount = round(p_deposit_amount, 2),
    balance_amount = round(p_balance_amount, 2),

    nightly_rate = case
      when selected_booking.booking_type = 'boarding'
      then round(p_unit_rate, 2)
      else null
    end,

    number_of_nights = case
      when selected_booking.booking_type = 'boarding'
      then p_quantity
      else null
    end,

    status = p_new_status,
    updated_at = now()
  where id = selected_booking.id
    and status = 'Pending';

  if not found then
    raise exception 'BOOKING_STATUS_CHANGED';
  end if;

  return query
  select
    selected_booking.id,
    selected_booking.booking_reference,
    selected_booking.status,
    p_new_status,
    selected_booking.booking_type,
    selected_booking.daycare_session,
    selected_booking.start_date,
    selected_booking.end_date,
    p_price_unit,
    round(p_unit_rate, 2),
    p_quantity,
    round(p_total_cost, 2),
    round(p_deposit_amount, 2),
    round(p_balance_amount, 2);
end;
$$;

revoke all
on function public.confirm_booking_v2_atomic(
  uuid,
  uuid,
  public.booking_price_unit,
  numeric,
  integer,
  numeric,
  numeric,
  numeric,
  numeric,
  text
)
from public;

grant execute
on function public.confirm_booking_v2_atomic(
  uuid,
  uuid,
  public.booking_price_unit,
  numeric,
  integer,
  numeric,
  numeric,
  numeric,
  numeric,
  text
)
to postgres, service_role;

comment on function public.confirm_booking_v2_atomic(
  uuid,
  uuid,
  public.booking_price_unit,
  numeric,
  integer,
  numeric,
  numeric,
  numeric,
  numeric,
  text
) is
  'Atomically consumes Booking Engine V2 capacity, saves a service-neutral pricing snapshot and confirms a Pending booking.';