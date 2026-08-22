create or replace function public.cancel_booking_v2_atomic(
  p_booking_id uuid
)
returns table (
  booking_id uuid,
  booking_reference text,
  previous_status text,
  new_status text,
  booking_type public.booking_type,
  start_date date,
  end_date date,
  availability_restored boolean,
  restored_dates integer,
  standard_allocations_released integer,
  shared_allocations_released integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_booking public.bookings%rowtype;
  capacity_allocation public.booking_capacity_allocations%rowtype;
  restored_date_count integer := 0;
  standard_allocation_count integer := 0;
  shared_allocation_count integer := 0;
  booking_consumed_capacity boolean;
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

  if selected_booking.status = 'Cancelled' then
    raise exception 'BOOKING_ALREADY_CANCELLED';
  end if;

  if selected_booking.status = 'Completed' then
    raise exception 'COMPLETED_BOOKING_CANNOT_BE_CANCELLED';
  end if;

  if selected_booking.status not in (
    'Pending',
    'Deposit Pending',
    'Balance Pending',
    'Balance Paid'
  ) then
    raise exception 'BOOKING_STATUS_CANNOT_BE_CANCELLED';
  end if;

  booking_consumed_capacity :=
    selected_booking.status in (
      'Deposit Pending',
      'Balance Pending',
      'Balance Paid'
    );

  if booking_consumed_capacity then
    for capacity_allocation in
      select *
      from public.booking_capacity_allocations
      where booking_capacity_allocations.booking_id =
        selected_booking.id
      order by allocation_date
      for update
    loop
      if capacity_allocation.allocation_type = 'standard' then
        update public.availability
        set
          spaces_available = least(
            total_spaces,
            spaces_available
              + capacity_allocation.space_units
          ),
          updated_at = now()
        where id = capacity_allocation.availability_id;

        if not found then
          raise exception
            'AVAILABILITY_RESTORE_FAILED:%',
            capacity_allocation.allocation_date;
        end if;

        restored_date_count :=
          restored_date_count + 1;

        standard_allocation_count :=
          standard_allocation_count + 1;
      elsif capacity_allocation.allocation_type = 'shared' then
        shared_allocation_count :=
          shared_allocation_count + 1;
      else
        raise exception
          'INVALID_CAPACITY_ALLOCATION_TYPE:%',
          capacity_allocation.allocation_date;
      end if;
    end loop;

    if not exists (
      select 1
      from public.booking_capacity_allocations
      where booking_capacity_allocations.booking_id =
        selected_booking.id
    ) then
      raise exception 'CAPACITY_ALLOCATIONS_MISSING';
    end if;

    delete from public.booking_capacity_allocations
    where booking_capacity_allocations.booking_id =
      selected_booking.id;
  end if;

  update public.bookings
  set
    status = 'Cancelled',
    updated_at = now()
  where id = selected_booking.id
    and status = selected_booking.status;

  if not found then
    raise exception 'BOOKING_CANCELLATION_FAILED';
  end if;

  return query
  select
    selected_booking.id,
    selected_booking.booking_reference,
    selected_booking.status,
    'Cancelled'::text,
    selected_booking.booking_type,
    selected_booking.start_date,
    selected_booking.end_date,
    restored_date_count > 0,
    restored_date_count,
    standard_allocation_count,
    shared_allocation_count;
end;
$$;

revoke all
on function public.cancel_booking_v2_atomic(uuid)
from public;

grant execute
on function public.cancel_booking_v2_atomic(uuid)
to postgres, service_role;

comment on function public.cancel_booking_v2_atomic(uuid) is
  'Atomically cancels a Booking Engine V2 booking, restores standard capacity allocations and releases shared allocations without increasing configured availability.';