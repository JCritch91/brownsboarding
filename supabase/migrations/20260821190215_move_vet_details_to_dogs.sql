alter table public.dogs
  add column if not exists vet_address text;

comment on column public.dogs.vet_name is
  'Name of the veterinary practice used for this dog.';

comment on column public.dogs.vet_phone is
  'Telephone number of the veterinary practice used for this dog.';

comment on column public.dogs.vet_address is
  'Address of the veterinary practice used for this dog.';

update public.dogs as dog
set
  vet_name = coalesce(
    nullif(btrim(dog.vet_name), ''),
    nullif(btrim(profile.vet_name), '')
  ),
  vet_phone = coalesce(
    nullif(btrim(dog.vet_phone), ''),
    nullif(btrim(profile.vet_phone), '')
  ),
  vet_address = coalesce(
    nullif(btrim(dog.vet_address), ''),
    nullif(btrim(profile.vet_address), '')
  ),
  updated_at = now()
from public.profiles as profile
where
  profile.id = dog.owner_id
  and (
    (
      nullif(btrim(dog.vet_name), '') is null
      and nullif(btrim(profile.vet_name), '') is not null
    )
    or (
      nullif(btrim(dog.vet_phone), '') is null
      and nullif(btrim(profile.vet_phone), '') is not null
    )
    or (
      nullif(btrim(dog.vet_address), '') is null
      and nullif(btrim(profile.vet_address), '') is not null
    )
  );