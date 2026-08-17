create or replace function public.deactivate_customer_account_atomic(
  p_customer_id uuid
)
returns table (
  customer_id uuid,
  deactivated_dogs integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_active boolean;
  v_active_booking_count integer;
  v_deactivated_dog_count integer;
begin
  /*
   * Lock the customer profile so another account action
   * cannot change it while deactivation is in progress.
   */
  select customer_profile.active
  into v_profile_active
  from public.profiles as customer_profile
  where customer_profile.id = p_customer_id
  for update;

  if not found then
    raise exception
      'CUSTOMER_NOT_FOUND: Customer profile could not be found.';
  end if;

  if not v_profile_active then
    raise exception
      'CUSTOMER_ALREADY_INACTIVE: Customer account is already inactive.';
  end if;

  /*
   * Lock any active bookings belonging to the customer.
   * The account cannot be deactivated while one exists.
   */
  perform customer_booking.id
  from public.bookings as customer_booking
  where customer_booking.owner_id = p_customer_id
    and customer_booking.status in (
      'Pending',
      'Deposit Pending',
      'Balance Pending',
      'Balance Paid'
    )
  for update;

  select count(*)::integer
  into v_active_booking_count
  from public.bookings as customer_booking
  where customer_booking.owner_id = p_customer_id
    and customer_booking.status in (
      'Pending',
      'Deposit Pending',
      'Balance Pending',
      'Balance Paid'
    );

  if v_active_booking_count > 0 then
    raise exception
      'ACTIVE_BOOKINGS_EXIST: Customer has % active booking(s).',
      v_active_booking_count;
  end if;

  /*
   * Deactivate every active dog belonging to the customer.
   * Historic dog and booking records remain available.
   */
  update public.dogs as customer_dog
  set
    active = false,
    updated_at = now()
  where customer_dog.owner_id = p_customer_id
    and customer_dog.active = true;

  get diagnostics
    v_deactivated_dog_count = row_count;

  /*
   * Deactivate the customer profile last. If anything
   * above fails, the complete transaction is rolled back.
   */
  update public.profiles as customer_profile
  set
    active = false,
    updated_at = now()
  where customer_profile.id = p_customer_id
    and customer_profile.active = true;

  if not found then
    raise exception
      'CUSTOMER_DEACTIVATION_FAILED: Customer status changed before deactivation completed.';
  end if;

  return query
  select
    p_customer_id,
    v_deactivated_dog_count;
end;
$$;

revoke all
on function public.deactivate_customer_account_atomic(uuid)
from public;

revoke all
on function public.deactivate_customer_account_atomic(uuid)
from anon;

revoke all
on function public.deactivate_customer_account_atomic(uuid)
from authenticated;

grant execute
on function public.deactivate_customer_account_atomic(uuid)
to service_role;