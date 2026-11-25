-- Task-App Improvements: AI Task Breakdown
--
-- A new table, subtasks, holds the steps that OpenAI suggests for a task
-- (Edge Function break-down-task). Each step belongs to one task and one user.
-- The original task app had only the profiles, tasks and usage_tracking tables.

create table public.subtasks (
  subtask_id uuid default gen_random_uuid() primary key,
  -- The task this step belongs to. Deleting the task deletes its steps.
  task_id uuid not null references public.tasks(task_id) on delete cascade,
  -- The owner, so Row Level Security can check it directly.
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  completed boolean not null default false,
  -- Order of the steps within the task (1, 2, 3, ...).
  position integer not null default 0,
  -- true when OpenAI wrote the step.
  ai_generated boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- List a task's steps in order quickly.
create index idx_subtasks_task_position on public.subtasks(task_id, position);

-- Row Level Security: users see and change only their own steps.
alter table public.subtasks enable row level security;

create policy "Users can CRUD own subtasks"
on public.subtasks for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Let signed-in users reach the table through the Data API (RLS still applies).
grant select, insert, update, delete on public.subtasks to authenticated;
