-- Cycle tracking logs for authenticated users only.
-- Personal records and trend estimates only; not medical diagnosis.
-- Run manually in Supabase SQL Editor. Do not disable RLS.

create table if not exists public.cycle_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  bleeding_level text,
  symptoms text[] not null default '{}'::text[],
  note text not null default '',
  period_status text,
  pain_level smallint,
  energy_level smallint,
  sleep_quality text,
  red_flags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cycle_logs_user_date_unique unique (user_id, log_date),
  constraint cycle_logs_bleeding_level_check
    check (
      bleeding_level is null
      or bleeding_level in ('spotting', 'light', 'medium', 'heavy')
    ),
  constraint cycle_logs_period_status_check
    check (period_status is null or period_status in ('started', 'ongoing', 'ended')),
  constraint cycle_logs_pain_level_check
    check (pain_level is null or pain_level between 0 and 10),
  constraint cycle_logs_energy_level_check
    check (energy_level is null or energy_level between 0 and 10),
  constraint cycle_logs_sleep_quality_check
    check (sleep_quality is null or sleep_quality in ('poor', 'normal', 'good'))
);

-- Incremental migration for projects where cycle_logs already exists.
alter table public.cycle_logs
  add column if not exists period_status text,
  add column if not exists pain_level smallint,
  add column if not exists energy_level smallint,
  add column if not exists sleep_quality text,
  add column if not exists red_flags text[] not null default '{}'::text[];

alter table public.cycle_logs drop constraint if exists cycle_logs_period_status_check;
alter table public.cycle_logs add constraint cycle_logs_period_status_check
  check (period_status is null or period_status in ('started', 'ongoing', 'ended'));

alter table public.cycle_logs drop constraint if exists cycle_logs_pain_level_check;
alter table public.cycle_logs add constraint cycle_logs_pain_level_check
  check (pain_level is null or pain_level between 0 and 10);

alter table public.cycle_logs drop constraint if exists cycle_logs_energy_level_check;
alter table public.cycle_logs add constraint cycle_logs_energy_level_check
  check (energy_level is null or energy_level between 0 and 10);

alter table public.cycle_logs drop constraint if exists cycle_logs_sleep_quality_check;
alter table public.cycle_logs add constraint cycle_logs_sleep_quality_check
  check (sleep_quality is null or sleep_quality in ('poor', 'normal', 'good'));

create index if not exists cycle_logs_user_id_log_date_idx
  on public.cycle_logs (user_id, log_date desc);

alter table public.cycle_logs enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.cycle_logs to authenticated;
revoke all on table public.cycle_logs from anon;

drop policy if exists "users can select own cycle logs" on public.cycle_logs;
create policy "users can select own cycle logs"
on public.cycle_logs
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users can insert own cycle logs" on public.cycle_logs;
create policy "users can insert own cycle logs"
on public.cycle_logs
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "users can update own cycle logs" on public.cycle_logs;
create policy "users can update own cycle logs"
on public.cycle_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can delete own cycle logs" on public.cycle_logs;
create policy "users can delete own cycle logs"
on public.cycle_logs
for delete
to authenticated
using (auth.uid() = user_id);
