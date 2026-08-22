create type public.booking_type as enum (
  'boarding',
  'daycare'
);

create type public.daycare_session_type as enum (
  'full_day',
  'half_day'
);

alter table public.dogs
  add column can_share_with_other_dogs boolean not null default true;

comment on column public.dogs.can_share_with_other_dogs is
  'Whether this dog can share the facility with dogs from another customer household.';

alter table public.bookings
  add column booking_type public.booking_type not null default 'boarding',
  add column daycare_session public.daycare_session_type,
  add column availability_confirmation_required boolean not null default false,
  add column availability_confirmed_at timestamptz,
  add column availability_confirmed_by uuid,
  add column space_units integer not null default 1;

alter table public.bookings
  add constraint bookings_daycare_session_check
  check (
    (
      booking_type = 'boarding'
      and daycare_session is null
    )
    or
    (
      booking_type = 'daycare'
      and daycare_session is not null
    )
  );

alter table public.bookings
  add constraint bookings_space_units_check
  check (space_units >= 1);

alter table public.bookings
  add constraint bookings_availability_confirmation_check
  check (
    availability_confirmation_required
    or (
      availability_confirmed_at is null
      and availability_confirmed_by is null
    )
  );

alter table public.bookings
  add constraint bookings_availability_confirmed_by_fkey
  foreign key (availability_confirmed_by)
  references auth.users(id)
  on delete set null;

comment on column public.bookings.booking_type is
  'The service requested for this booking: boarding or daycare.';

comment on column public.bookings.daycare_session is
  'Full-day or half-day session. Required only for daycare bookings.';

comment on column public.bookings.availability_confirmation_required is
  'True when one or more requested dates did not have configured availability when the booking was submitted.';

comment on column public.bookings.availability_confirmed_at is
  'The date and time an administrator confirmed unconfigured availability for this booking.';

comment on column public.bookings.availability_confirmed_by is
  'The administrator who confirmed unconfigured availability for this booking.';

comment on column public.bookings.space_units is
  'Number of configured facility spaces consumed by this booking. Dogs from one household normally consume one space unit.';

create table public.booking_dogs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  dog_id uuid not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),

  constraint booking_dogs_booking_id_fkey
    foreign key (booking_id)
    references public.bookings(id)
    on delete cascade,

  constraint booking_dogs_dog_id_fkey
    foreign key (dog_id)
    references public.dogs(id),

  constraint booking_dogs_booking_dog_key
    unique (booking_id, dog_id),

  constraint booking_dogs_sort_order_check
    check (sort_order >= 0)
);

comment on table public.booking_dogs is
  'Dogs included in a booking. Supports one or more dogs from the booking customer household.';

create index booking_dogs_booking_id_idx
  on public.booking_dogs (booking_id);

create index booking_dogs_dog_id_idx
  on public.booking_dogs (dog_id);

create index bookings_booking_type_dates_idx
  on public.bookings (
    booking_type,
    start_date,
    end_date
  );

create index bookings_availability_confirmation_idx
  on public.bookings (
    availability_confirmation_required,
    availability_confirmed_at
  )
  where availability_confirmation_required = true;

insert into public.booking_dogs (
  booking_id,
  dog_id,
  sort_order
)
select
  booking.id,
  booking.dog_id,
  0
from public.bookings as booking
on conflict (booking_id, dog_id) do nothing;

create or replace function public.validate_booking_dog_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_owner_id uuid;
  dog_owner_id uuid;
begin
  select owner_id
  into booking_owner_id
  from public.bookings
  where id = new.booking_id;

  if booking_owner_id is null then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  select owner_id
  into dog_owner_id
  from public.dogs
  where id = new.dog_id;

  if dog_owner_id is null then
    raise exception 'DOG_NOT_FOUND';
  end if;

  if booking_owner_id <> dog_owner_id then
    raise exception 'DOG_DOES_NOT_BELONG_TO_BOOKING_OWNER';
  end if;

  return new;
end;
$$;

create trigger validate_booking_dog_ownership_trigger
before insert or update
on public.booking_dogs
for each row
execute function public.validate_booking_dog_ownership();

alter table public.booking_dogs enable row level security;

create policy "Customers can view dogs on their own bookings"
on public.booking_dogs
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings
    where bookings.id = booking_dogs.booking_id
      and bookings.owner_id = auth.uid()
  )
);

create policy "Active admins can view all booking dogs"
on public.booking_dogs
for select
to authenticated
using (public.is_admin_user());

create policy "Customers can add dogs to their own pending bookings"
on public.booking_dogs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.bookings
    where bookings.id = booking_dogs.booking_id
      and bookings.owner_id = auth.uid()
      and bookings.status = 'Pending'
  )
  and exists (
    select 1
    from public.dogs
    where dogs.id = booking_dogs.dog_id
      and dogs.owner_id = auth.uid()
      and dogs.active = true
  )
);

create policy "Active admins can add booking dogs"
on public.booking_dogs
for insert
to authenticated
with check (public.is_admin_user());

create policy "Customers can remove dogs from their own pending bookings"
on public.booking_dogs
for delete
to authenticated
using (
  exists (
    select 1
    from public.bookings
    where bookings.id = booking_dogs.booking_id
      and bookings.owner_id = auth.uid()
      and bookings.status = 'Pending'
  )
);

create policy "Active admins can remove booking dogs"
on public.booking_dogs
for delete
to authenticated
using (public.is_admin_user());

create policy "Active admins can update booking dogs"
on public.booking_dogs
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

grant select, insert, update, delete
on table public.booking_dogs
to authenticated;