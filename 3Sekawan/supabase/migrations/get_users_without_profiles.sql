-- Returns auth users who don't have a row in public."userProfiles"
-- Needed by app/users/create.tsx enrollment screen.

CREATE OR REPLACE FUNCTION public.get_users_without_profiles()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    u.id,
    u.email,
    u.created_at
  FROM auth.users u
  LEFT JOIN public."userProfiles" p ON p.id = u.id
  WHERE p.id IS NULL
    AND u.email IS NOT NULL
  ORDER BY u.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_users_without_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_users_without_profiles() TO authenticated;
