
-- Add parent_user_id to link employees to their parent user
ALTER TABLE public.app_users ADD COLUMN parent_user_id uuid REFERENCES public.app_users(id) ON DELETE CASCADE DEFAULT NULL;

-- Add max_employees to control how many employees a user can create
ALTER TABLE public.app_users ADD COLUMN max_employees integer NOT NULL DEFAULT 0;

-- Index for faster lookups
CREATE INDEX idx_app_users_parent ON public.app_users(parent_user_id);
