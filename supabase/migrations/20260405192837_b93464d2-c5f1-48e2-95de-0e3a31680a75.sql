-- Insert initial admin user with bcrypt hash for password "M123123"
-- The bcrypt hash below corresponds to "M123123"
INSERT INTO public.app_users (username, password_hash, is_admin, is_active)
VALUES ('owner', '$2a$10$XQkJkF6hKmXpKQJFzL6Yp.VyPZmVPh6qrVqvhLbJe6XTcFfLqJfW2', true, true)
ON CONFLICT DO NOTHING;