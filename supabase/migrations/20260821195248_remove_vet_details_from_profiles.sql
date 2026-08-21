alter table public.profiles
  drop column if exists vet_name,
  drop column if exists vet_phone,
  drop column if exists vet_address;