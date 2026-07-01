-- Run in Supabase SQL Editor or via `supabase db push` after linking the project.

ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS passport_path text;

COMMENT ON COLUMN public.candidates.passport_path IS
  'Path in candidate-documents bucket for passport/ID scan uploaded from DocuSeal webhook';
