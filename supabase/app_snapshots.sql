create table if not exists public.app_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_snapshots enable row level security;

drop policy if exists "users can read own snapshot" on public.app_snapshots;
create policy "users can read own snapshot"
on public.app_snapshots
for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own snapshot" on public.app_snapshots;
create policy "users can insert own snapshot"
on public.app_snapshots
for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update own snapshot" on public.app_snapshots;
create policy "users can update own snapshot"
on public.app_snapshots
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

