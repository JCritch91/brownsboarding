create or replace function public.confirm_booking_availability_v2_atomic(
  p_booking_id uuid,
  p_admin_user_id uuid
)
returns table (
  booking_id uuid,
  booking_reference text,
  availability_confirmation_required boolean,
  availability_confirmed_at timestamptz,
  availability_confirmed_by uuid,
  created_availability_dates integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_booking public.bookings%rowtype;
  occupied_date date;
  occupied_dates date[];
  confirmed_at timestamptz;
  created_dates integer := 0;
  admin_is_active boolean;
begin
  if p_booking_id is null then
    raise exception 'BOOKING_ID_REQUIRED';
  end if;

  if p_admin_user_id is null then
    raise exception 'ADMIN_USER_ID_REQUIRED';
  end if;

  select exists (
    select 1
    from public.profiles
    where id = p_admin_user_id
      and active = true
      and is_admin = true
  )
  into admin_is_active;

  if not admin_is_active then
    raise exception 'ACTIVE_ADMIN_REQUIRED';
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

  if not selected_booking.availability_confirmation_required then
    raise exception 'AVAILABILITY_CONFIRMATION_NOT_REQUIRED';
  end if;

  if selected_booking.availability_confirmed_at is not null then
    return query
    select
      selected_booking.id,
      selected_booking.booking_reference,
      selected_booking.availability_confirmation_required,
      selected_booking.availability_confirmed_at,
      selected_booking.availability_confirmed_by,
      0;

    return;
  end if;

  if selected_booking.booking_type = 'daycare' then
    if selected_booking.start_date <> selected_booking.end_date then
      raise exception 'INVALID_DAYCARE_DATES';
    end if;

    occupied_dates := array[selected_booking.start_date];
  elsif selected_booking.booking_type = 'boarding' then
    if selected_booking.end_date <= selected_booking.start_date then
      raise exception 'INVALID_BOARDING_DATES';
    end if;

    select array_agg(generated_date::date order by generated_date)
    into occupied_dates
    from generate_series(
      selected_booking.start_date,
      selected_booking.end_date - 1,
      interval '1 day'
    ) as generated_date;
  else
    raise exception 'INVALID_BOOKING_TYPE';
  end if;

  if occupied_dates is null or cardinality(occupied_dates) = 0 then
    raise exception 'NO_OCCUPIED_DATES';
  end if;

  foreach occupied_date in array occupied_dates loop
    insert into public.availability (
      date,
      total_spaces,
      spaces_available,
      available,
      notes,
      updated_at
    )
    values (
      occupied_date,
      1,
      1,
      true,
      'Availability confirmed through Booking Engine V2 booking review.',
      now()
    )
    on conflict (date) do nothing;

    if found then
      created_dates := created_dates + 1;
    end if;
  end loop;

  if exists (
    select 1
    from unnest(occupied_dates) as requested_date(date)
    left join public.availability
      on availability.date = requested_date.date
    where availability.id is null
  ) then
    raise exception 'AVAILABILITY_RECORD_MISSING';
  end if;

  if exists (
    select 1
    from unnest(occupied_dates) as requested_date(date)
    join public.availability
      on availability.date = requested_date.date
    where availability.available = false
  ) then
    raise exception 'AVAILABILITY_EXPLICITLY_UNAVAILABLE';
  end if;

  confirmed_at := now();

  update public.bookings
  set
    availability_confirmed_at = confirmed_at,
    availability_confirmed_by = p_admin_user_id,
    updated_at = confirmed_at
  where id = selected_booking.id;

  return query
  select
    selected_booking.id,
    selected_booking.booking_reference,
    true,
    confirmed_at,
    p_admin_user_id,
    created_dates;
end;
$$;

revoke all
on function public.confirm_booking_availability_v2_atomic(
  uuid,
  uuid
)
from public;

grant execute
on function public.confirm_booking_availability_v2_atomic(
  uuid,
  uuid
)
to postgres, service_role;

comment on function public.confirm_booking_availability_v2_atomic(
  uuid,
  uuid
) is
  'Confirms unconfigured availability for a Pending V2 booking, creates missing availability records with one available space, and records the approving administrator.';