-- Cover project foreign keys used for cascade deletes and ownership queries.
create index job_queue_project_id_idx on public.job_queue (project_id);
create index sandbox_usage_project_id_idx on public.sandbox_usage (project_id);
