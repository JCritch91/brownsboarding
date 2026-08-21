alter table public.profiles
  alter column active set default false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    is_admin,
    active,
    was_activated,
    created_at,
    updated_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'address1', ''),
    nullif(new.raw_user_meta_data ->> 'address2', ''),
    coalesce(new.raw_user_meta_data ->> 'town', ''),
    coalesce(new.raw_user_meta_data ->> 'postcode', ''),
    false,
    false,
    false,
    now(),
    now()
  )
  on conflict (id) do update
  set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    email = excluded.email,
    phone = excluded.phone,
    address_line_1 = excluded.address_line_1,
    address_line_2 = excluded.address_line_2,
    town = excluded.town,
    postcode = excluded.postcode,
    updated_at = now();

  return new;
end;
$function$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

grant execute on function public.handle_new_user() to postgres;
grant execute on function public.handle_new_user() to service_role;