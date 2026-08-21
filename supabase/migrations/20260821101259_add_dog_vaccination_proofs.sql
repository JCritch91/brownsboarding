create table public.dog_vaccination_proofs (
  id uuid primary key default gen_random_uuid(),

  dog_id uuid not null
    references public.dogs(id)
    on delete cascade,

  storage_path text,
  original_file_name text,
  mime_type text,
  file_size_bytes bigint,

  vaccination_expiry date not null,

  uploaded_at timestamptz,
  checked_at timestamptz,
  checked_by uuid
    references auth.users(id)
    on delete set null,

  deleted_at timestamptz,
  deletion_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dog_vaccination_proofs_dog_id_key
    unique (dog_id),

  constraint dog_vaccination_proofs_file_size_check
    check (
      file_size_bytes is null
      or (
        file_size_bytes > 0
        and file_size_bytes <= 5242880
      )
    ),

  constraint dog_vaccination_proofs_mime_type_check
    check (
      mime_type is null
      or mime_type in (
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp'
      )
    ),

  constraint dog_vaccination_proofs_checked_state_check
    check (
      (
        checked_at is null
        and checked_by is null
      )
      or (
        checked_at is not null
        and checked_by is not null
      )
    ),

  constraint dog_vaccination_proofs_deleted_state_check
    check (
      deleted_at is null
      or storage_path is null
    ),

  constraint dog_vaccination_proofs_active_file_metadata_check
    check (
      storage_path is null
      or (
        original_file_name is not null
        and mime_type is not null
        and file_size_bytes is not null
        and uploaded_at is not null
        and deleted_at is null
      )
    )
);

create index dog_vaccination_proofs_expiry_idx
  on public.dog_vaccination_proofs (vaccination_expiry);

create index dog_vaccination_proofs_review_idx
  on public.dog_vaccination_proofs (checked_at)
  where storage_path is not null
    and deleted_at is null;

create index dog_vaccination_proofs_checked_by_idx
  on public.dog_vaccination_proofs (checked_by)
  where checked_by is not null;

alter table public.dog_vaccination_proofs
  enable row level security;

revoke all
  on table public.dog_vaccination_proofs
  from anon;

revoke all
  on table public.dog_vaccination_proofs
  from authenticated;

grant select
  on table public.dog_vaccination_proofs
  to authenticated;

grant all
  on table public.dog_vaccination_proofs
  to service_role;

create policy "Customers can view own dog vaccination proofs"
  on public.dog_vaccination_proofs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.dogs
      where dogs.id = dog_vaccination_proofs.dog_id
        and dogs.owner_id = auth.uid()
    )
  );

create policy "Active admins can view all dog vaccination proofs"
  on public.dog_vaccination_proofs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.active = true
        and profiles.is_admin = true
    )
  );

create or replace function public.reset_vaccination_proof_review()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
begin
  if
    new.storage_path is distinct from old.storage_path
    or new.vaccination_expiry is distinct from old.vaccination_expiry
    or new.deleted_at is distinct from old.deleted_at
  then
    new.checked_at := null;
    new.checked_by := null;
  end if;

  new.updated_at := now();

  return new;
end;
$function$;

create trigger reset_vaccination_proof_review_on_change
  before update
  on public.dog_vaccination_proofs
  for each row
  execute function public.reset_vaccination_proof_review();

revoke all
  on function public.reset_vaccination_proof_review()
  from public;

revoke all
  on function public.reset_vaccination_proof_review()
  from anon;

revoke all
  on function public.reset_vaccination_proof_review()
  from authenticated;

grant execute
  on function public.reset_vaccination_proof_review()
  to postgres;

grant execute
  on function public.reset_vaccination_proof_review()
  to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'dog-vaccination-proofs',
  'dog-vaccination-proofs',
  false,
  5242880,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;