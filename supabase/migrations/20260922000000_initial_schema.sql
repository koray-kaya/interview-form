-- Initial schema: responses, answers, probe_calls. Only the server (service_role,
-- via the secret key) may touch these tables; the public roles get nothing.

create table public.responses (
  id            uuid primary key default gen_random_uuid(),
  company_uid   text check (char_length(company_uid) <= 32),
  probe_allowed boolean not null default false,
  lang          text not null check (lang in ('de', 'en')),
  form_version  text not null,
  consented_at  timestamptz not null,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table public.answers (
  id             uuid primary key default gen_random_uuid(),
  response_id    uuid not null references public.responses(id) on delete cascade,
  question_id    text not null,
  followup_index smallint not null default 0 check (followup_index between 0 and 2),
  question_text  text not null,
  value          jsonb not null,
  created_at     timestamptz not null default now(),
  unique (response_id, question_id, followup_index)
);

create table public.probe_calls (
  id             bigint generated always as identity primary key,
  response_id    uuid not null references public.responses(id) on delete cascade,
  question_id    text not null,
  followup_index smallint not null,
  model          text not null,
  prompt_version text not null,
  decision       text not null check (decision in ('ask', 'stop', 'error', 'rejected')),
  reason         text,
  error_class    text,
  input_tokens   int,
  output_tokens  int,
  latency_ms     int,
  created_at     timestamptz not null default now()
);

create index probe_calls_response_id_idx on public.probe_calls (response_id);
create index responses_unfinished_idx on public.responses (created_at) where completed_at is null;

alter table public.responses   enable row level security;
alter table public.answers     enable row level security;
alter table public.probe_calls enable row level security;
-- no policies: service_role bypasses RLS; nobody else has a grant

revoke all on public.responses, public.answers, public.probe_calls from anon, authenticated;
grant select, insert, update, delete on public.responses, public.answers to service_role;
grant select, insert, delete on public.probe_calls to service_role;

-- Stores one answer and deletes the answers it made obsolete, in one
-- transaction. Refuses a response that does not exist or is completed.
create function public.save_answer(
  p_response_id    uuid,
  p_question_id    text,
  p_followup_index smallint,
  p_question_text  text,
  p_value          jsonb,
  p_pruned         text[]
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.responses
    where id = p_response_id and completed_at is null
  ) then
    return false;
  end if;

  insert into public.answers (response_id, question_id, followup_index, question_text, value)
  values (p_response_id, p_question_id, p_followup_index, p_question_text, p_value)
  on conflict (response_id, question_id, followup_index)
  do update set question_text = excluded.question_text, value = excluded.value;

  delete from public.answers
  where response_id = p_response_id and question_id = any (p_pruned);

  return true;
end;
$$;

revoke execute on function public.save_answer from public, anon, authenticated;
grant execute on function public.save_answer to service_role;
