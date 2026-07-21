-- Enable pgcrypto for the digest function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create app_users table for login management
CREATE TABLE public.app_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read for login verification
CREATE POLICY "Anyone can read app_users for login"
  ON public.app_users
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow anonymous insert/update/delete for admin management
CREATE POLICY "Anyone can insert app_users"
  ON public.app_users
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update app_users"
  ON public.app_users
  FOR UPDATE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can delete app_users"
  ON public.app_users
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_app_users_updated_at
  BEFORE UPDATE ON public.app_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default admin user (password: 1234, using simple hash)
INSERT INTO public.app_users (username, password_hash, is_active, is_admin)
VALUES ('admin', encode(extensions.digest('1234', 'sha256'), 'hex'), true, true);
