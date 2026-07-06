
-- Create saved_quotes table
CREATE TABLE public.saved_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  quote_number TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'calculator',
  quote_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (block direct client access, all access via edge function with service role)
ALTER TABLE public.saved_quotes ENABLE ROW LEVEL SECURITY;

-- Add employees_can_view_quotes column to app_users
ALTER TABLE public.app_users ADD COLUMN employees_can_view_quotes BOOLEAN NOT NULL DEFAULT false;

-- Index for faster lookups
CREATE INDEX idx_saved_quotes_user_id ON public.saved_quotes(user_id);
CREATE INDEX idx_saved_quotes_created_at ON public.saved_quotes(created_at DESC);
