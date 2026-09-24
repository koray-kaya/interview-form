-- Where the model ran each call (AI Gateway routing metadata), so the thesis
-- can show that every participant's answer was processed in the EU. Null when
-- the gateway did not report a region (a failed call, or no routing metadata).
alter table public.probe_calls add column inference_region text
  check (inference_region is null or char_length(inference_region) <= 16);
