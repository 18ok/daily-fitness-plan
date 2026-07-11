create table if not exists public.experience_feedback (
  id uuid primary key default gen_random_uuid(),
  client_feedback_id text not null unique,
  rating text not null,
  note text,
  time_choice text not null,
  status_choice text not null,
  condition_choice text not null,
  content_version integer not null,
  submitted_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint experience_feedback_client_id_length
    check (char_length(client_feedback_id) between 1 and 180),
  constraint experience_feedback_rating
    check (rating in ('适合', '太难', '不符合状态')),
  constraint experience_feedback_note_length
    check (note is null or char_length(note) <= 200),
  constraint experience_feedback_content_version
    check (content_version > 0)
);

alter table public.experience_feedback enable row level security;

grant insert on table public.experience_feedback to anon, authenticated;
revoke select, update, delete on table public.experience_feedback from anon, authenticated;

drop policy if exists "pilot users can insert constrained feedback" on public.experience_feedback;
create policy "pilot users can insert constrained feedback"
on public.experience_feedback
for insert
to anon, authenticated
with check (
  char_length(client_feedback_id) between 1 and 180
  and rating in ('适合', '太难', '不符合状态')
  and (note is null or char_length(note) <= 200)
  and content_version > 0
);
