-- =====================================================================
--  TUNDAAN ELECTRICITY SYSTEM — Supabase database setup
--  Paste this whole file into Supabase → SQL Editor → New query → RUN
-- =====================================================================

-- ---------- TABLES ----------------------------------------------------

create table if not exists public.houses (
  id          bigint generated always as identity primary key,
  name        text not null,                 -- e.g. "Ernie's House"
  owner_name  text,                          -- e.g. "Ernie Jhun Tundaan"
  meter_no    text,                          -- submeter number / label
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  full_name   text,
  role        text not null default 'house' check (role in ('admin','house')),
  house_id    bigint references public.houses(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- One-row settings table (the fixed rate per kWh)
create table if not exists public.settings (
  id            int primary key default 1 check (id = 1),
  rate_per_kwh  numeric(10,4) not null default 13.00,
  updated_at    timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- Monthly submeter readings. kWh and amount are computed automatically.
-- The rate is saved with each reading, so changing the rate later
-- never changes old bills.
create table if not exists public.readings (
  id                bigint generated always as identity primary key,
  house_id          bigint not null references public.houses(id) on delete cascade,
  billing_month     date not null,           -- always the 1st of the month
  reading_date      date not null default current_date,
  previous_reading  numeric(12,2) not null,
  current_reading   numeric(12,2) not null,
  kwh               numeric(12,2) generated always as (current_reading - previous_reading) stored,
  rate              numeric(10,4) not null,
  amount            numeric(12,2) generated always as (round((current_reading - previous_reading) * rate, 2)) stored,
  is_paid           boolean not null default false,
  paid_date         date,
  notes             text,
  created_at        timestamptz not null default now(),
  unique (house_id, billing_month),
  check (current_reading >= previous_reading)
);

-- ---------- HELPER FUNCTIONS -----------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_house()
returns bigint language sql stable security definer set search_path = public as $$
  select house_id from public.profiles where id = auth.uid();
$$;

-- Every new login account automatically gets a profile (role = house,
-- no house yet). Mama (admin) then links it to a house.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, full_name, role)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))),
    new.raw_user_meta_data->>'full_name',
    'house'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- SECURITY (Row Level Security) -----------------------------
--  Admin (Mama): sees and edits everything.
--  House account: sees ONLY its own house and its own readings.

alter table public.houses   enable row level security;
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.readings enable row level security;

drop policy if exists "houses_read"  on public.houses;
drop policy if exists "houses_admin" on public.houses;
create policy "houses_read"  on public.houses for select to authenticated
  using (public.is_admin() or id = public.my_house());
create policy "houses_admin" on public.houses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "profiles_read"  on public.profiles;
drop policy if exists "profiles_admin" on public.profiles;
create policy "profiles_read"  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "profiles_admin" on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "settings_read"  on public.settings;
drop policy if exists "settings_admin" on public.settings;
create policy "settings_read"  on public.settings for select to authenticated
  using (true);
create policy "settings_admin" on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "readings_read"  on public.readings;
drop policy if exists "readings_admin" on public.readings;
create policy "readings_read"  on public.readings for select to authenticated
  using (public.is_admin() or house_id = public.my_house());
create policy "readings_admin" on public.readings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
--  AFTER creating Mama's login (see README step 3), run this ONCE
--  (change 'mama' if you used a different username):
--
--  update public.profiles set role = 'admin', full_name = 'Mama'
--  where username = 'mama';
-- =====================================================================
