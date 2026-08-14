create or replace function public.record_booking_payment_atomic(
  p_booking_id uuid,
  p_payment_type text,
  p_payment_date date
)
returns table (
  booking_id uuid,
  booking_reference text,
  payment_id uuid,
  invoice_number text,
  payment_type text,
  payment_amount numeric,
  previous_status text,
  new_status text,
  payment_date date
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_payment public.payments%rowtype;
  v_payment_amount numeric;
  v_new_status text;
begin
  /*
   * Lock the booking row so two requests cannot record
   * the same payment at the same time.
   */
  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if p_payment_date is null then
    raise exception 'PAYMENT_DATE_REQUIRED';
  end if;

  if p_payment_date > current_date then
    raise exception 'PAYMENT_DATE_IN_FUTURE';
  end if;

  if p_payment_type not in (
    'Deposit',
    'Balance'
  ) then
    raise exception 'INVALID_PAYMENT_TYPE';
  end if;

  /*
   * Deposit payments are valid only while the booking
   * is awaiting its deposit.
   */
  if p_payment_type = 'Deposit' then
    if v_booking.status <> 'Deposit Pending' then
      raise exception
        'INVALID_DEPOSIT_STATUS: Current status is %',
        v_booking.status;
    end if;

    if v_booking.deposit_amount is null then
      raise exception 'DEPOSIT_AMOUNT_MISSING';
    end if;

    if v_booking.deposit_amount <= 0 then
      raise exception 'INVALID_DEPOSIT_AMOUNT';
    end if;

    v_payment_amount :=
      v_booking.deposit_amount;

    v_new_status :=
      'Balance Pending';
  end if;

  /*
   * Balance payments are valid only while the booking
   * is awaiting its remaining balance.
   *
   * This also supports short-notice bookings, where the
   * entire cost is stored as the balance amount.
   */
  if p_payment_type = 'Balance' then
    if v_booking.status <> 'Balance Pending' then
      raise exception
        'INVALID_BALANCE_STATUS: Current status is %',
        v_booking.status;
    end if;

    if v_booking.balance_amount is null then
      raise exception 'BALANCE_AMOUNT_MISSING';
    end if;

    if v_booking.balance_amount <= 0 then
      raise exception 'INVALID_BALANCE_AMOUNT';
    end if;

    v_payment_amount :=
      v_booking.balance_amount;

    v_new_status :=
      'Balance Paid';
  end if;

  /*
   * Prevent duplicate payment records for the same
   * booking and payment stage.
   */
if exists (
  select 1
  from public.payments as existing_payment
  where existing_payment.booking_id = p_booking_id
    and existing_payment.payment_type = p_payment_type
) then
  raise exception
    'PAYMENT_ALREADY_RECORDED: Payment type is %',
    p_payment_type;
end if;

  /*
   * Create the authoritative payment record using the
   * amount stored against the booking.
   *
   * The existing payments-table trigger or default is
   * expected to generate invoice_number.
   */
  insert into public.payments (
    booking_id,
    owner_id,
    dog_id,
    amount,
    payment_type,
    payment_date,
    notes,
    updated_at
  )
  values (
    v_booking.id,
    v_booking.owner_id,
    v_booking.dog_id,
    v_payment_amount,
    p_payment_type,
    p_payment_date,
    p_payment_type ||
      ' payment recorded for booking ' ||
      v_booking.booking_reference,
    now()
  )
  returning *
  into v_payment;

  if v_payment.id is null then
    raise exception 'PAYMENT_INSERT_FAILED';
  end if;

  /*
   * Update the booking only after the payment record
   * has been created successfully.
   */
  if p_payment_type = 'Deposit' then
    update public.bookings
    set
      status = v_new_status,
      deposit_paid_at = p_payment_date,
      updated_at = now()
    where id = p_booking_id
      and status = v_booking.status;
  else
    update public.bookings
    set
      status = v_new_status,
      balance_paid_at = p_payment_date,
      updated_at = now()
    where id = p_booking_id
      and status = v_booking.status;
  end if;

  if not found then
    raise exception 'BOOKING_PAYMENT_UPDATE_FAILED';
  end if;

  return query
  select
    v_booking.id,
    v_booking.booking_reference,
    v_payment.id,
    v_payment.invoice_number,
    p_payment_type,
    v_payment_amount,
    v_booking.status,
    v_new_status,
    p_payment_date;
end;
$$;


revoke all on function public.record_booking_payment_atomic(
  uuid,
  text,
  date
) from public;

revoke all on function public.record_booking_payment_atomic(
  uuid,
  text,
  date
) from anon;

revoke all on function public.record_booking_payment_atomic(
  uuid,
  text,
  date
) from authenticated;

grant execute on function public.record_booking_payment_atomic(
  uuid,
  text,
  date
) to service_role;