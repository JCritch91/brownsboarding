create type public.booking_capacity_allocation_type as enum (
  'standard',
  'shared'
);

create table public.booking_capacity_allocations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  availability_id uuid not null,
  allocation_date date not null,
  allocation_type public.booking_capacity_allocation_type not null,
  space_units integer not null default 1,
  created_at timestamptz not null default now(),

  constraint booking_capacity_allocations_booking_id_fkey
    foreign key (booking_id)
    references public.bookings(id)
    on delete cascade,

  constraint booking_capacity_allocations_availability_id_fkey
    foreign key (availability_id)
    references public.availability(id),

  constraint booking_capacity_allocations_booking_date_key
    unique (booking_id, allocation_date),

  constraint booking_capacity_allocations_space_units_check
    check (space_units >= 1)
);

comment on table public.booking_capacity_allocations is
  'Records how each confirmed booking consumes capacity on each occupied date. Standard allocations reduce configured spaces; shared allocations use the compatible overflow allowance.';

comment on column public.booking_capacity_allocations.allocation_type is
  'Whether the booking used standard configured capacity or the compatible shared-booking allowance.';

create index booking_capacity_allocations_booking_id_idx
  on public.booking_capacity_allocations (booking_id);

create index booking_capacity_allocations_date_idx
  on public.booking_capacity_allocations (allocation_date);

create index booking_capacity_allocations_availability_id_idx
  on public.booking_capacity_allocations (availability_id);

alter table public.booking_capacity_allocations
  enable row level security;

create policy "Customers can view capacity allocations for their own bookings"
on public.booking_capacity_allocations
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings
    where bookings.id =
      booking_capacity_allocations.booking_id
      and bookings.owner_id = auth.uid()
  )
);

create policy "Active admins can view all capacity allocations"
on public.booking_capacity_allocations
for select
to authenticated
using (public.is_admin_user());

grant select
on table public.booking_capacity_allocations
to authenticated;

insert into public.booking_capacity_allocations (
  booking_id,
  availability_id,
  allocation_date,
  allocation_type,
  space_units
)
select
  booking.id,
  availability.id,
  occupied_date.date,
  'standard',
  greatest(1, booking.space_units)
from public.bookings as booking
cross join lateral (
  select generated_date::date as date
  from generate_series(
    booking.start_date,
    booking.end_date - 1,
    interval '1 day'
  ) as generated_date
  where booking.booking_type = 'boarding'

  union all

  select booking.start_date
  where booking.booking_type = 'daycare'
    and booking.start_date = booking.end_date
) as occupied_date
join public.availability
  on availability.date = occupied_date.date
where booking.status in (
  'Deposit Pending',
  'Balance Pending',
  'Balance Paid'
)
on conflict (booking_id, allocation_date) do nothing;

create or replace function public.consume_booking_capacity_v2_atomic(
  p_booking_id uuid
)
returns table (
  booking_id uuid,
  booking_reference text,
  occupied_dates integer,
  standard_capacity_dates integer,
  shared_capacity_dates integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_booking public.bookings%rowtype;
  occupied_date date;
  occupied_dates date[];
  availability_record public.availability%rowtype;
  selected_dogs_can_share boolean;
  existing_dogs_can_share boolean;
  existing_space_units integer;
  configured_consumed_units integer;
  shared_overflow_units integer;
  standard_dates integer := 0;
  shared_dates integer := 0;
begin
  if p_booking_id is null then
    raise exception 'BOOKING_ID_REQUIRED';
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

  if exists (
    select 1
    from public.booking_capacity_allocations
    where booking_id = selected_booking.id
  ) then
    raise exception 'CAPACITY_ALREADY_ALLOCATED';
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

    select array_agg(
      generated_date::date
      order by generated_date
    )
    into occupied_dates
    from generate_series(
      selected_booking.start_date,
      selected_booking.end_date - 1,
      interval '1 day'
    ) as generated_date;
  else
    raise exception 'INVALID_BOOKING_TYPE';
  end if;

  if occupied_dates is null
    or cardinality(occupied_dates) = 0
  then
    raise exception 'NO_OCCUPIED_DATES';
  end if;

  select bool_and(dog.can_share_with_other_dogs)
  into selected_dogs_can_share
  from public.booking_dogs as booking_dog
  join public.dogs as dog
    on dog.id = booking_dog.dog_id
  where booking_dog.booking_id = selected_booking.id;

  if selected_dogs_can_share is null then
    raise exception 'BOOKING_DOGS_REQUIRED';
  end if;

  foreach occupied_date in array occupied_dates loop
    select *
    into availability_record
    from public.availability
    where date = occupied_date
    for update;

    if not found then
      raise exception
        'AVAILABILITY_RECORD_MISSING:%',
        occupied_date;
    end if;

    if not availability_record.available then
      raise exception
        'AVAILABILITY_UNAVAILABLE:%',
        occupied_date;
    end if;

    if (
      availability_record.spaces_available
      >= selected_booking.space_units
    ) then
      update public.availability
      set
        spaces_available =
          spaces_available
          - selected_booking.space_units,
        updated_at = now()
      where id = availability_record.id
        and spaces_available
          >= selected_booking.space_units;

      if not found then
        raise exception
          'INSUFFICIENT_AVAILABILITY:%',
          occupied_date;
      end if;

      insert into public.booking_capacity_allocations (
        booking_id,
        availability_id,
        allocation_date,
        allocation_type,
        space_units
      )
      values (
        selected_booking.id,
        availability_record.id,
        occupied_date,
        'standard',
        selected_booking.space_units
      );

      standard_dates := standard_dates + 1;
      continue;
    end if;

    if not selected_dogs_can_share then
      raise exception
        'REQUESTED_DOG_CANNOT_SHARE:%',
        occupied_date;
    end if;

    select coalesce(
      bool_and(dog.can_share_with_other_dogs),
      false
    )
    into existing_dogs_can_share
    from public.bookings as existing_booking
    join public.booking_dogs as existing_booking_dog
      on existing_booking_dog.booking_id =
        existing_booking.id
    join public.dogs as dog
      on dog.id = existing_booking_dog.dog_id
    where existing_booking.id <> selected_booking.id
      and existing_booking.status in (
        'Deposit Pending',
        'Balance Pending',
        'Balance Paid'
      )
      and (
        (
          existing_booking.booking_type = 'boarding'
          and existing_booking.start_date <= occupied_date
          and existing_booking.end_date > occupied_date
        )
        or
        (
          existing_booking.booking_type = 'daycare'
          and existing_booking.start_date = occupied_date
          and existing_booking.end_date = occupied_date
        )
      );

    if not existing_dogs_can_share then
      raise exception
        'EXISTING_DOG_CANNOT_SHARE:%',
        occupied_date;
    end if;

    select coalesce(
      sum(existing_booking.space_units),
      0
    )
    into existing_space_units
    from public.bookings as existing_booking
    where existing_booking.id <> selected_booking.id
      and existing_booking.status in (
        'Deposit Pending',
        'Balance Pending',
        'Balance Paid'
      )
      and (
        (
          existing_booking.booking_type = 'boarding'
          and existing_booking.start_date <= occupied_date
          and existing_booking.end_date > occupied_date
        )
        or
        (
          existing_booking.booking_type = 'daycare'
          and existing_booking.start_date = occupied_date
          and existing_booking.end_date = occupied_date
        )
      );

    configured_consumed_units :=
      availability_record.total_spaces
      - availability_record.spaces_available;

    shared_overflow_units := greatest(
      0,
      existing_space_units - configured_consumed_units
    );

    if shared_overflow_units >= 1 then
      raise exception
        'SHARED_BOOKING_LIMIT_REACHED:%',
        occupied_date;
    end if;

    insert into public.booking_capacity_allocations (
      booking_id,
      availability_id,
      allocation_date,
      allocation_type,
      space_units
    )
    values (
      selected_booking.id,
      availability_record.id,
      occupied_date,
      'shared',
      selected_booking.space_units
    );

    shared_dates := shared_dates + 1;
  end loop;

  return query
  select
    selected_booking.id,
    selected_booking.booking_reference,
    cardinality(occupied_dates),
    standard_dates,
    shared_dates;
end;
$$;

revoke all
on function public.consume_booking_capacity_v2_atomic(uuid)
from public;

grant execute
on function public.consume_booking_capacity_v2_atomic(uuid)
to postgres, service_role;