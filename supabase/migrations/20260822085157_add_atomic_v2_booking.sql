create or replace function public.create_pending_booking_v2_atomic(
  p_owner_id uuid,
  p_dog_ids uuid[],
  p_booking_type public.booking_type,
  p_daycare_session public.daycare_session_type,
  p_start_date date,
  p_end_date date,
  p_notes text,
  p_availability_confirmation_required boolean,
  p_space_units integer
)
returns table (
  booking_id uuid,
  booking_reference text,
  owner_id uuid,
  primary_dog_id uuid,
  booking_type public.booking_type,
  daycare_session public.daycare_session_type,
  start_date date,
  end_date date,
  booking_status text,
  booking_notes text,
  availability_confirmation_required boolean,
  availability_confirmed_at timestamptz,
  availability_confirmed_by uuid,
  space_units integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_booking public.bookings%rowtype;
  selected_dog_id uuid;
  selected_dog_count integer;
  distinct_dog_count integer;
  active_owner_dog_count integer;
  dog_position integer;
begin
  if p_owner_id is null then
    raise exception 'BOOKING_OWNER_REQUIRED';
  end if;

  if p_dog_ids is null or cardinality(p_dog_ids) = 0 then
    raise exception 'BOOKING_DOGS_REQUIRED';
  end if;

  selected_dog_count := cardinality(p_dog_ids);

  if selected_dog_count > 2 then
    raise exception 'BOOKING_DOG_LIMIT_EXCEEDED';
  end if;

  select count(distinct dog_id)
  into distinct_dog_count
  from unnest(p_dog_ids) as selected_dogs(dog_id);

  if distinct_dog_count <> selected_dog_count then
    raise exception 'DUPLICATE_BOOKING_DOG';
  end if;

  select count(*)
  into active_owner_dog_count
  from public.dogs
  where id = any(p_dog_ids)
    and owner_id = p_owner_id
    and active = true;

  if active_owner_dog_count <> selected_dog_count then
    raise exception 'INVALID_BOOKING_DOG';
  end if;

  if p_booking_type = 'boarding' then
    if p_daycare_session is not null then
      raise exception 'BOARDING_DAYCARE_SESSION_NOT_ALLOWED';
    end if;

    if p_end_date <= p_start_date then
      raise exception 'INVALID_BOARDING_DATES';
    end if;
  elsif p_booking_type = 'daycare' then
    if p_daycare_session is null then
      raise exception 'DAYCARE_SESSION_REQUIRED';
    end if;

    if p_end_date <> p_start_date then
      raise exception 'INVALID_DAYCARE_DATES';
    end if;
  else
    raise exception 'INVALID_BOOKING_TYPE';
  end if;

  if p_start_date < current_date then
    raise exception 'BOOKING_START_DATE_IN_PAST';
  end if;

  if p_space_units is null or p_space_units < 1 then
    raise exception 'INVALID_SPACE_UNITS';
  end if;

  if length(coalesce(btrim(p_notes), '')) > 2000 then
    raise exception 'BOOKING_NOTES_TOO_LONG';
  end if;

  insert into public.bookings (
    owner_id,
    dog_id,
    booking_type,
    daycare_session,
    start_date,
    end_date,
    status,
    notes,
    availability_confirmation_required,
    availability_confirmed_at,
    availability_confirmed_by,
    space_units,
    updated_at
  )
  values (
    p_owner_id,
    p_dog_ids[1],
    p_booking_type,
    p_daycare_session,
    p_start_date,
    p_end_date,
    'Pending',
    nullif(btrim(p_notes), ''),
    coalesce(p_availability_confirmation_required, false),
    null,
    null,
    p_space_units,
    now()
  )
  returning *
  into new_booking;

  for dog_position in 1..selected_dog_count loop
    selected_dog_id := p_dog_ids[dog_position];

    insert into public.booking_dogs (
      booking_id,
      dog_id,
      sort_order
    )
    values (
      new_booking.id,
      selected_dog_id,
      dog_position - 1
    );
  end loop;

  return query
  select
    new_booking.id,
    new_booking.booking_reference,
    new_booking.owner_id,
    new_booking.dog_id,
    new_booking.booking_type,
    new_booking.daycare_session,
    new_booking.start_date,
    new_booking.end_date,
    new_booking.status,
    new_booking.notes,
    new_booking.availability_confirmation_required,
    new_booking.availability_confirmed_at,
    new_booking.availability_confirmed_by,
    new_booking.space_units,
    new_booking.created_at;
end;
$$;

revoke all
on function public.create_pending_booking_v2_atomic(
  uuid,
  uuid[],
  public.booking_type,
  public.daycare_session_type,
  date,
  date,
  text,
  boolean,
  integer
)
from public;

grant execute
on function public.create_pending_booking_v2_atomic(
  uuid,
  uuid[],
  public.booking_type,
  public.daycare_session_type,
  date,
  date,
  text,
  boolean,
  integer
)
to postgres, service_role;

comment on function public.create_pending_booking_v2_atomic(
  uuid,
  uuid[],
  public.booking_type,
  public.daycare_session_type,
  date,
  date,
  text,
  boolean,
  integer
) is
  'Atomically creates a Pending Booking Engine V2 booking and links one or more active dogs belonging to the booking owner.';