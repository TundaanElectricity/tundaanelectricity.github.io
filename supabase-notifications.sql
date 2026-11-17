-- =====================================================================
--  TUNDRAVOLT — push notification table
--  Supabase → SQL Editor → New query → paste → RUN  (run once)
-- =====================================================================

create table if not exists public.push_subscriptions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Each person can only save / see / remove their OWN phone subscriptions.
-- The Edge Function uses the service role, so it can read all of them.
drop policy if exists "push_own" on public.push_subscriptions;
create policy "push_own" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
