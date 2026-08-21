alter table public.pricing_settings
  add column effective_from date;

alter table public.pricing_settings
  add column daycare_full_day_rate numeric(10,2);

alter table public.pricing_settings
  add column daycare_half_day_rate numeric(10,2);

alter table public.pricing_settings
  add column daycare_deposit_percentage numeric(5,2);

update public.pricing_settings
set
  effective_from = current_date,
  daycare_full_day_rate = 40.00,
  daycare_half_day_rate = 25.00,
  daycare_deposit_percentage = 25.00
where effective_from is null;

alter table public.pricing_settings
  alter column effective_from set not null;

alter table public.pricing_settings
  alter column daycare_full_day_rate set not null;

alter table public.pricing_settings
  alter column daycare_half_day_rate set not null;

alter table public.pricing_settings
  alter column daycare_deposit_percentage set not null;

alter table public.pricing_settings
  alter column daycare_full_day_rate set default 40.00;

alter table public.pricing_settings
  alter column daycare_half_day_rate set default 25.00;

alter table public.pricing_settings
  alter column daycare_deposit_percentage set default 25.00;

create index pricing_settings_effective_from_idx
  on public.pricing_settings (effective_from);