-- Create shop_expenses table for recording daily shop expenses
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.shop_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expense_date date NOT NULL,
  category text NOT NULL,
  description text,
  amount integer NOT NULL CHECK (amount >= 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text
);

-- Index for filtering by date
CREATE INDEX IF NOT EXISTS idx_shop_expenses_expense_date ON public.shop_expenses(expense_date DESC);

-- Index for filtering by category
CREATE INDEX IF NOT EXISTS idx_shop_expenses_category ON public.shop_expenses(category);

-- Enable Row Level Security (RLS)
ALTER TABLE public.shop_expenses ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view all expenses
CREATE POLICY "Authenticated users can view expenses"
  ON public.shop_expenses
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Authenticated users can insert expenses
CREATE POLICY "Authenticated users can insert expenses"
  ON public.shop_expenses
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Authenticated users can update expenses
CREATE POLICY "Authenticated users can update expenses"
  ON public.shop_expenses
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Authenticated users can delete expenses
CREATE POLICY "Authenticated users can delete expenses"
  ON public.shop_expenses
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Add comment
COMMENT ON TABLE public.shop_expenses IS 'Daily shop expenses: cleaning supplies, staff wages, utilities, etc.';
