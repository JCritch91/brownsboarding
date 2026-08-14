create or replace function public.cancel_booking_atomic(
  p_booking_id uuid
)
returns table (
  booking_id uuid,
  booking_reference text,
  previous_status text,
  new_status text,
  start_date date,
  end_date date,
  availability_restored boolean,
  restored_dates integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_should_restore_availability boolean;
  v_required_dates integer;
  v_existing_dates integer;
  v_restored_dates integer := 0;
begin
  /*
   * Lock the booking so concurrent requests cannot
   * cancel the same booking more than once.
   */
  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if v_booking.status = 'Cancelled' then
    raise exception 'BOOKING_ALREADY_CANCELLED';
  end if;

  if v_booking.status = 'Completed' then
    raise exception 'COMPLETED_BOOKING_CANNOT_BE_CANCELLED';
  end if;

  if v_booking.status not in (
    'Pending',
    'Deposit Pending',
    'Balance Pending',
    'Balance Paid'
  ) then
    raise exception
      'BOOKING_STATUS_CANNOT_BE_CANCELLED: Current status is %',
      v_booking.status;
  end if;

  if v_booking.end_date <= v_booking.start_date then
    raise exception 'INVALID_BOOKING_DATES';
  end if;

  /*
   * Pending bookings have not consumed availability.
   * Confirmed and payment-stage bookings have.
   */
  v_should_restore_availability :=
    v_booking.status in (
      'Deposit Pending',
      'Balance Pending',
      'Balance Paid'
    );

  if v_should_restore_availability then
    /*
     * The departure date does not consume capacity.
     */
    v_required_dates :=
      v_booking.end_date - v_booking.start_date;

    /*
     * Lock all availability records for occupied nights.
     */
    perform id
    from public.availability
    where date >= v_booking.start_date
      and date < v_booking.end_date
    order by date
    for update;

    select count(*)
    into v_existing_dates
    from public.availability
    where date >= v_booking.start_date
      and date < v_booking.end_date;

    if v_existing_dates <> v_required_dates then
      raise exception
        'MISSING_AVAILABILITY_RECORDS: Required %, found %',
        v_required_dates,
        v_existing_dates;
    end if;

    /*
     * Restore one space for every occupied night.
     *
     * LEAST prevents spaces_available from exceeding
     * total_spaces if the request is somehow repeated
     * against inconsistent historical data.
     */
    update public.availability
    set
      spaces_available = least(
        total_spaces,
        spaces_available + 1
      ),
      updated_at = now()
    where date >= v_booking.start_date
      and date < v_booking.end_date;

    get diagnostics v_restored_dates = row_count;

    if v_restored_dates <> v_required_dates then
      raise exception
        'AVAILABILITY_RESTORE_FAILED: Required %, restored %',
        v_required_dates,
        v_restored_dates;
    end if;
  end if;

  /*
   * Cancel the booking only after availability has
   * been restored successfully where required.
   */
  update public.bookings
  set
    status = 'Cancelled',
    updated_at = now()
  where id = p_booking_id
    and status = v_booking.status;

  if not found then
    raise exception 'BOOKING_CANCELLATION_FAILED';
  end if;

  return query
  select
    v_booking.id,
    v_booking.booking_reference,
    v_booking.status,
    'Cancelled'::text,
    v_booking.start_date,
    v_booking.end_date,
    v_should_restore_availability,
    v_restored_dates;
end;
$$;

revoke all on function public.cancel_booking_atomic(
  uuid
) from public;

revoke all on function public.cancel_booking_atomic(
  uuid
) from anon;

revoke all on function public.cancel_booking_atomic(
  uuid
) from authenticated;

grant execute on function public.cancel_booking_atomic(
  uuid
) to service_role;