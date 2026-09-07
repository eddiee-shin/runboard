-- Preserve source start time in the import key; concurrent retries cannot duplicate a run.
alter table public.run_sessions add column if not exists import_key text;
create unique index if not exists run_sessions_profile_import_key
  on public.run_sessions (profile_id, import_key);
