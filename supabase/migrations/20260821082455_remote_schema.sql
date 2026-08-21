set local check_function_bodies = off;

alter default privileges for role "postgres" in schema "public" revoke all on sequences from "anon";

alter default privileges for role "postgres" in schema "public" revoke all on sequences from "authenticated";

alter default privileges for role "postgres" in schema "public" revoke all on sequences from "service_role";

alter default privileges for role "postgres" in schema "public" revoke all on tables from "anon";

alter default privileges for role "postgres" in schema "public" revoke all on tables from "authenticated";

alter default privileges for role "postgres" in schema "public" revoke all on tables from "service_role";

create sequence "public"."booking_reference_seq" as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 START with 1 cache 1 no cycle;

create sequence "public"."payment_invoice_number_seq" as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 START with 1 cache 1 no cycle;

create table "public"."availability" (
  "id"               uuid                     not null default gen_random_uuid(),
  "date"             date                     not null,
  "total_spaces"     integer                  not null default 1,
  "spaces_available" integer                  not null default 1,
  "available"        boolean                  not null default true,
  "notes"            text,
  "created_at"       timestamp with time zone not null default now(),
  "updated_at"       timestamp with time zone not null default now(),
  constraint "availability_date_key" unique (date),
  constraint "availability_pkey" primary key (id)
);

alter table "public"."availability"
  enable row level security;

create table "public"."bookings" (
  "id"                             uuid                     not null default gen_random_uuid(),
  "owner_id"                       uuid                     not null,
  "dog_id"                         uuid                     not null,
  "start_date"                     date                     not null,
  "end_date"                       date                     not null,
  "status"                         text                     not null default 'Pending'::text,
  "notes"                          text,
  "created_at"                     timestamp with time zone not null default now(),
  "updated_at"                     timestamp with time zone not null default now(),
  "deposit_paid_at"                date,
  "deposit_received_email_sent"    boolean                  not null default false,
  "deposit_received_email_sent_at" timestamp with time zone,
  "pricing_setting_id"             uuid,
  "nightly_rate"                   numeric(10,2),
  "number_of_nights"               integer,
  "total_cost"                     numeric(10,2),
  "deposit_amount"                 numeric(10,2),
  "balance_amount"                 numeric(10,2),
  "balance_paid_at"                date,
  "booking_reference"              text                     not null default ('BB-B-'::text || lpad((nextval('public.booking_reference_seq'::regclass))::text, 5, '0'::text)),
  constraint "bookings_booking_reference_key" unique (booking_reference),
  constraint "bookings_pkey" primary key (id)
);

alter table "public"."bookings"
  enable row level security;

create table "public"."dogs" (
  "id"                          uuid                     not null default gen_random_uuid(),
  "owner_id"                    uuid                     not null,
  "name"                        text                     not null,
  "breed"                       text,
  "date_of_birth"               date,
  "weight_kg"                   numeric,
  "gender"                      text,
  "neutered"                    boolean,
  "vaccinated"                  boolean,
  "vaccination_expiry"          date,
  "microchip_number"            text,
  "medical_notes"               text,
  "medication_notes"            text,
  "feeding_notes"               text,
  "behaviour_notes"             text,
  "active"                      boolean                  default true,
  "created_at"                  timestamp with time zone default now(),
  "updated_at"                  timestamp with time zone default now(),
  "meet_and_greet_completed"    boolean                  default false,
  "meet_and_greet_completed_at" timestamp with time zone,
  "colour"                      text,
  "vet_name"                    text,
  "vet_phone"                   text,
  constraint "dogs_pkey" primary key (id)
);

alter table "public"."dogs"
  enable row level security;

create table "public"."google_availability_calendar_events" (
  "id"                uuid                     not null default gen_random_uuid(),
  "availability_id"   uuid                     not null,
  "google_event_id"   text                     not null,
  "google_event_link" text,
  "created_at"        timestamp with time zone not null default now(),
  "updated_at"        timestamp with time zone not null default now(),
  constraint "google_availability_calendar_events_availability_id_key" unique (availability_id),
  constraint "google_availability_calendar_events_pkey" primary key (id)
);

alter table "public"."google_availability_calendar_events"
  enable row level security;

create table "public"."google_calendar_events" (
  "id"                uuid                     not null default gen_random_uuid(),
  "booking_id"        uuid                     not null,
  "google_event_id"   text                     not null,
  "google_event_link" text,
  "created_at"        timestamp with time zone not null default now(),
  "updated_at"        timestamp with time zone not null default now(),
  constraint "google_calendar_events_booking_id_key" unique (booking_id),
  constraint "google_calendar_events_pkey" primary key (id)
);

alter table "public"."google_calendar_events"
  enable row level security;

create table "public"."meet_and_greets" (
  "id"             uuid                     not null default gen_random_uuid(),
  "customer_id"    uuid                     not null,
  "requested_date" date,
  "requested_time" time without time zone,
  "scheduled_date" date,
  "scheduled_time" time without time zone,
  "status"         text                     default 'requested'::text,
  "admin_notes"    text,
  "customer_notes" text,
  "created_at"     timestamp with time zone default now(),
  "updated_at"     timestamp with time zone default now(),
  constraint "meet_and_greets_pkey" primary key (id),
  constraint "meet_and_greets_status_check" check ((status = ANY (ARRAY['requested'::text, 'scheduled'::text, 'completed'::text, 'cancelled'::text, 'rejected'::text])))
);

alter table "public"."meet_and_greets"
  enable row level security;

create table "public"."payments" (
  "id"             uuid                     not null default gen_random_uuid(),
  "invoice_number" text
    not null default ((('BB-'::text || to_char(now(), 'YYYY'::text)) || '-'::text) || lpad((nextval('public.payment_invoice_number_seq'::regclass))::text, 6, '0'::text)),
  "booking_id"     uuid                     not null,
  "owner_id"       uuid                     not null,
  "dog_id"         uuid                     not null,
  "amount"         numeric(10,2)            not null,
  "payment_type"   text                     not null,
  "payment_date"   date                     not null,
  "notes"          text,
  "created_at"     timestamp with time zone not null default now(),
  "updated_at"     timestamp with time zone not null default now(),
  constraint "payments_invoice_number_key" unique (invoice_number),
  constraint "payments_pkey" primary key (id)
);

alter table "public"."payments"
  enable row level security;

create table "public"."pricing_settings" (
  "id"                 uuid                     not null default gen_random_uuid(),
  "name"               text                     not null,
  "nightly_rate"       numeric(10,2)            not null,
  "deposit_percentage" numeric(5,2)             not null default 25.00,
  "active"             boolean                  not null default true,
  "created_at"         timestamp with time zone not null default now(),
  "updated_at"         timestamp with time zone not null default now(),
  constraint "pricing_settings_pkey" primary key (id)
);

alter table "public"."pricing_settings"
  enable row level security;

create table "public"."profiles" (
  "id"                      uuid                     not null,
  "first_name"              text,
  "last_name"               text,
  "email"                   text,
  "phone"                   text,
  "address_line_1"          text,
  "address_line_2"          text,
  "town"                    text,
  "postcode"                text,
  "emergency_contact_name"  text,
  "emergency_contact_phone" text,
  "vet_name"                text,
  "vet_phone"               text,
  "vet_address"             text,
  "meet_and_greet_approved" boolean                  default false,
  "is_admin"                boolean                  default false,
  "created_at"              timestamp with time zone default now(),
  "updated_at"              timestamp with time zone default now(),
  "active"                  boolean                  not null default true,
  "activation_token"        text,
  "activation_token_expiry" timestamp with time zone,
  "was_activated"           boolean                  not null default false,
  "activated_at"            timestamp with time zone,
  constraint "profiles_pkey" primary key (id)
);

alter table "public"."profiles"
  enable row level security;

create or replace function public.adjust_availability_for_booking (
  p_start_date date,
  p_end_date   date,
  p_change     integer
)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
  AS $function$
begin
  if not exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
    and profiles.is_admin = true
  ) then
    raise exception 'Only admins can adjust availability';
  end if;

  update public.availability
  set
    spaces_available = greatest(
      0,
      least(total_spaces, spaces_available + p_change)
    ),
    updated_at = now()
  where date >= p_start_date
  and date < p_end_date;
end;
$function$;

create or replace function public.cancel_booking_atomic (
  p_booking_id uuid
)
  returns table (
    booking_id            uuid,
    booking_reference     text,
    previous_status       text,
    new_status            text,
    start_date            date,
    end_date              date,
    availability_restored boolean,
    restored_dates        integer
  )
  language plpgsql
  set search_path to 'public'
  AS $function$
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
$function$;

create or replace function public.complete_eligible_bookings()
  returns table (
    booking_id        uuid,
    booking_reference text,
    owner_id          uuid,
    dog_id            uuid,
    start_date        date,
    end_date          date,
    previous_status   text,
    new_status        text,
    notes             text,
    total_cost        numeric,
    deposit_amount    numeric,
    balance_amount    numeric
  )
  language plpgsql
  set search_path to 'public'
  AS $function$
begin
  /*
   * Complete every fully paid booking whose stay
   * ended before today.
   *
   * The conditional status check prevents a booking
   * that has changed state from being completed.
   */
  return query
  update public.bookings as booking
  set
    status = 'Completed',
    updated_at = now()
  where booking.status = 'Balance Paid'
    and booking.end_date < current_date
  returning
    booking.id,
    booking.booking_reference,
    booking.owner_id,
    booking.dog_id,
    booking.start_date,
    booking.end_date,
    'Balance Paid'::text,
    booking.status,
    booking.notes,
    booking.total_cost,
    booking.deposit_amount,
    booking.balance_amount;
end;
$function$;

create or replace function public.confirm_booking_atomic (
  p_booking_id         uuid,
  p_pricing_setting_id uuid,
  p_nightly_rate       numeric,
  p_number_of_nights   integer,
  p_total_cost         numeric,
  p_deposit_amount     numeric,
  p_balance_amount     numeric,
  p_new_status         text
)
  returns table (
    booking_id        uuid,
    booking_reference text,
    previous_status   text,
    new_status        text,
    start_date        date,
    end_date          date
  )
  language plpgsql
  set search_path to 'public'
  AS $function$
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
$function$;

create or replace function public.deactivate_customer_account_atomic (
  p_customer_id uuid
)
  returns table (
    customer_id      uuid,
    deactivated_dogs integer
  )
  language plpgsql
  security definer
  set search_path to 'public'
  AS $function$
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
$function$;

create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
  AS $function$
begin
  insert into public.profiles (
    id,
    first_name,
    last_name,
    email,
    phone,
    address_line_1,
    address_line_2,
    town,
    postcode,
    created_at,
    updated_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'mobile', ''),
    coalesce(new.raw_user_meta_data ->> 'address1', ''),
    coalesce(new.raw_user_meta_data ->> 'address2', ''),
    coalesce(new.raw_user_meta_data ->> 'town', ''),
    coalesce(new.raw_user_meta_data ->> 'postcode', ''),
    now(),
    now()
  );

  return new;
end;
$function$;

create or replace function public.is_admin()
  returns boolean
  language sql
  security definer
  set search_path to 'public'
  AS $function$
  select exists (
    select 1
    from profiles
    where id = auth.uid()
    and is_admin = true
  );
$function$;

create or replace function public.is_admin_user()
  returns boolean
  language sql
  security definer
  set search_path to 'public'
  AS $function$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
    and is_admin = true
  );
$function$;

create or replace function public.record_booking_payment_atomic (
  p_booking_id   uuid,
  p_payment_type text,
  p_payment_date date
)
  returns table (
    booking_id        uuid,
    booking_reference text,
    payment_id        uuid,
    invoice_number    text,
    payment_type      text,
    payment_amount    numeric,
    previous_status   text,
    new_status        text,
    payment_date      date
  )
  language plpgsql
  set search_path to 'public'
  AS $function$
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
$function$;

alter table "public"."bookings"
  add constraint "bookings_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

alter table "public"."dogs"
  add constraint "dogs_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

alter table "public"."bookings"
  add constraint "bookings_dog_id_fkey" foreign key (dog_id) references public.dogs(id);

alter table "public"."google_availability_calendar_events"
  add constraint "google_availability_calendar_events_availability_id_fkey" foreign key (availability_id) references public.availability(id) on delete cascade;

alter table "public"."google_calendar_events"
  add constraint "google_calendar_events_booking_id_fkey" foreign key (booking_id) references public.bookings(id) on delete cascade;

alter table "public"."meet_and_greets"
  add constraint "meet_and_greets_customer_id_fkey" foreign key (customer_id) references auth.users(id) on delete cascade;

alter table "public"."payments"
  add constraint "payments_booking_id_fkey" foreign key (booking_id) references public.bookings(id);

alter table "public"."payments"
  add constraint "payments_dog_id_fkey" foreign key (dog_id) references public.dogs(id);

alter table "public"."payments"
  add constraint "payments_owner_id_fkey" foreign key (owner_id) references auth.users(id);

alter table "public"."bookings"
  add constraint "bookings_pricing_setting_id_fkey" foreign key (pricing_setting_id) references public.pricing_settings(id);

alter table "public"."profiles"
  add constraint "profiles_id_fkey" foreign key (id) references auth.users(id) on delete cascade;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create policy "Admins can delete availability" on "public"."availability"
  for delete
  to "authenticated"
  using ((exists ( select 1
   from public.profiles
  where ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));

create policy "Admins can insert availability" on "public"."availability"
  for insert
  to "authenticated"
  with check ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));

create policy "Admins can update availability" on "public"."availability"
  for update
  to "authenticated"
  using ((exists ( select 1
   from public.profiles
  where ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))))
  with check ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));

create policy "Anyone can view availability" on "public"."availability"
  for select
  to PUBLIC
  using (true);

create policy "Active admins can create bookings" on "public"."bookings"
  for insert
  to "authenticated"
  with check ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true) AND (profiles.active = true)))));

create policy "Admins can update all bookings" on "public"."bookings"
  for update
  to PUBLIC
  using (public.is_admin_user());

create policy "Admins can view all bookings" on "public"."bookings"
  for select
  to PUBLIC
  using (public.is_admin_user());

create policy "Users can create own bookings" on "public"."bookings"
  for insert
  to PUBLIC
  with check ((auth.uid() = owner_id));

create policy "Users can delete own bookings" on "public"."bookings"
  for delete
  to PUBLIC
  using ((auth.uid() = owner_id));

create policy "Users can update own bookings" on "public"."bookings"
  for update
  to PUBLIC
  using ((auth.uid() = owner_id));

create policy "Users can view own bookings" on "public"."bookings"
  for select
  to PUBLIC
  using ((auth.uid() = owner_id));

create policy "Admins can manage all dogs" on "public"."dogs"
  for all
  to "authenticated"
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can view all dogs" on "public"."dogs"
  for select
  to PUBLIC
  using (public.is_admin_user());

create policy "Users can add own dogs" on "public"."dogs"
  for insert
  to "authenticated"
  with check ((owner_id = auth.uid()));

create policy "Users can delete own dogs" on "public"."dogs"
  for delete
  to PUBLIC
  using ((auth.uid() = owner_id));

create policy "Users can insert own dogs" on "public"."dogs"
  for insert
  to PUBLIC
  with check ((auth.uid() = owner_id));

create policy "Users can update own dogs" on "public"."dogs"
  for update
  to "authenticated"
  using ((owner_id = auth.uid()))
  with check ((owner_id = auth.uid()));

create policy "Users can view own dogs" on "public"."dogs"
  for select
  to "authenticated"
  using (((owner_id = auth.uid()) or public.is_admin()));

create policy "Admins can manage meet and greets" on "public"."meet_and_greets"
  for all
  to "authenticated"
  using (public.is_admin())
  with check (public.is_admin());

create policy "Users can request meet and greet" on "public"."meet_and_greets"
  for insert
  to "authenticated"
  with check ((customer_id = auth.uid()));

create policy "Users can update own meet and greet notes" on "public"."meet_and_greets"
  for update
  to "authenticated"
  using ((customer_id = auth.uid()))
  with check ((customer_id = auth.uid()));

create policy "Users can view own meet and greets" on "public"."meet_and_greets"
  for select
  to "authenticated"
  using (((customer_id = auth.uid()) or public.is_admin()));

create policy "Admins can insert payments" on "public"."payments"
  for insert
  to PUBLIC
  with check (public.is_admin_user());

create policy "Admins can update payments" on "public"."payments"
  for update
  to PUBLIC
  using (public.is_admin_user());

create policy "Admins can view all payments" on "public"."payments"
  for select
  to PUBLIC
  using (public.is_admin_user());

create policy "Admins can insert pricing settings" on "public"."pricing_settings"
  for insert
  to PUBLIC
  with check (public.is_admin_user());

create policy "Admins can update pricing settings" on "public"."pricing_settings"
  for update
  to PUBLIC
  using (public.is_admin_user());

create policy "Admins can view pricing settings" on "public"."pricing_settings"
  for select
  to PUBLIC
  using (public.is_admin_user());

create policy "Allow logged in users read active pricing settings" on "public"."pricing_settings"
  for select
  to "authenticated"
  using ((active = true));

create policy "Allow public read active pricing settings" on "public"."pricing_settings"
  for select
  to "anon"
  using ((active = true));

create policy "Authenticated users can view active pricing" on "public"."pricing_settings"
  for select
  to PUBLIC
  using (((auth.uid() is not null) AND (active = true)));

create policy "Admins can update any profile" on "public"."profiles"
  for update
  to "authenticated"
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can view all profiles" on "public"."profiles"
  for select
  to PUBLIC
  using (public.is_admin_user());

create policy "Users can update own profile" on "public"."profiles"
  for update
  to "authenticated"
  using ((id = auth.uid()))
  with check ((id = auth.uid()));

create policy "Users can update their own profile" on "public"."profiles"
  for update
  to PUBLIC
  using ((auth.uid() = id));

create policy "Users can view own profile" on "public"."profiles"
  for select
  to "authenticated"
  using (((id = auth.uid()) or public.is_admin()));

create policy "Users can view their own profile" on "public"."profiles"
  for select
  to PUBLIC
  using ((auth.uid() = id));

grant execute on function "public"."adjust_availability_for_booking"(date, date, integer) to public, "anon", "authenticated", "postgres", "service_role";

revoke all on function "public"."cancel_booking_atomic"(uuid) from public;

grant execute on function "public"."cancel_booking_atomic"(uuid) to "postgres", "service_role";

revoke all on function "public"."complete_eligible_bookings"() from public;

grant execute on function "public"."complete_eligible_bookings"() to "postgres", "service_role";

revoke all on function "public"."confirm_booking_atomic"(uuid, uuid, numeric, integer, numeric, numeric, numeric, text) from public;

grant execute on function "public"."confirm_booking_atomic"(uuid, uuid, numeric, integer, numeric, numeric, numeric, text) to "postgres", "service_role";

revoke all on function "public"."deactivate_customer_account_atomic"(uuid) from public;

grant execute on function "public"."deactivate_customer_account_atomic"(uuid) to "postgres", "service_role";

grant execute on function "public"."handle_new_user"() to public, "anon", "authenticated", "postgres", "service_role";

grant execute on function "public"."is_admin"() to public, "anon", "authenticated", "postgres", "service_role";

grant execute on function "public"."is_admin_user"() to public, "anon", "authenticated", "postgres", "service_role";

revoke all on function "public"."record_booking_payment_atomic"(uuid, text, date) from public;

grant execute on function "public"."record_booking_payment_atomic"(uuid, text, date) to "postgres", "service_role";

grant select, update, usage on sequence "public"."booking_reference_seq" to "anon", "authenticated", "postgres", "service_role";

grant select, update, usage on sequence "public"."payment_invoice_number_seq" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."availability" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."bookings" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."dogs" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update
  on table "public"."google_availability_calendar_events"
  to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."google_calendar_events" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."meet_and_greets" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."payments" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."pricing_settings" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."profiles" to "anon", "authenticated", "postgres", "service_role";

alter default privileges for role "postgres" in schema "public" grant select, update, usage on sequences to "anon";

alter default privileges for role "postgres" in schema "public" grant select, update, usage on sequences to "authenticated";

alter default privileges for role "postgres" in schema "public" grant select, update, usage on sequences to "service_role";

alter default privileges for role "postgres" in schema "public" grant execute on FUNCTIONS to "anon";

alter default privileges for role "postgres" in schema "public" grant execute on FUNCTIONS to "authenticated";

alter default privileges for role "postgres" in schema "public" grant execute on FUNCTIONS to "service_role";

alter default privileges for role "postgres" in schema "public" grant delete, insert, maintain, references, select, trigger, truncate, update on tables to "anon";

alter default privileges for role "postgres" in schema "public" grant delete, insert, maintain, references, select, trigger, truncate, update on tables to "authenticated";

alter default privileges for role "postgres" in schema "public" grant delete, insert, maintain, references, select, trigger, truncate, update on tables to "service_role";

