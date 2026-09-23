-- The follow-up question a model call produced (decision 'ask'). The answer to
-- a follow-up takes its question_text from here, never from the browser.
alter table public.probe_calls add column followup_text text
  check (followup_text is null or char_length(followup_text) <= 200);
