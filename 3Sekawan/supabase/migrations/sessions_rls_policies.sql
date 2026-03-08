-- RLS policies for sessions table (billiard)
-- Run in Supabase SQL Editor if checkout/update fails with permission errors.
-- Ensures authenticated users can select, insert, and update sessions (start + checkout).

-- Enable RLS if not already
ALTER TABLE IF EXISTS public.sessions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read active/ended sessions (for billiard screen and sales report)
DROP POLICY IF EXISTS "Authenticated can select sessions" ON public.sessions;
CREATE POLICY "Authenticated can select sessions"
  ON public.sessions
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert new sessions (start meja)
DROP POLICY IF EXISTS "Authenticated can insert sessions" ON public.sessions;
CREATE POLICY "Authenticated can insert sessions"
  ON public.sessions
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update sessions (extend time, checkout/paid)
DROP POLICY IF EXISTS "Authenticated can update sessions" ON public.sessions;
CREATE POLICY "Authenticated can update sessions"
  ON public.sessions
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE public.sessions IS 'Billiard table sessions: start, extend, checkout (paid).';
