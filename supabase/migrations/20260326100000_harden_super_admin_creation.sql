-- Harden super admin creation and lifecycle controls.

-- 1) Ensure only one active super_admin can exist at a time.
WITH ranked_super_admins AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.system_users
  WHERE role = 'super_admin' AND is_active = TRUE
)
UPDATE public.system_users su
SET is_active = FALSE
FROM ranked_super_admins rsa
WHERE su.id = rsa.id
  AND rsa.rn > 1;

DROP INDEX IF EXISTS uq_system_users_active_super_admin;
CREATE UNIQUE INDEX uq_system_users_active_super_admin
  ON public.system_users ((role))
  WHERE role = 'super_admin' AND is_active = TRUE;

-- 2) Enforce that super_admin rows must be linked to a real Supabase Auth identity.
ALTER TABLE public.system_users
  DROP CONSTRAINT IF EXISTS chk_super_admin_requires_supabase_uid;

ALTER TABLE public.system_users
  ADD CONSTRAINT chk_super_admin_requires_supabase_uid
  CHECK (role <> 'super_admin' OR supabase_uid IS NOT NULL);

-- 3) Guardrail: prevent demoting/deactivating the last active super_admin.
CREATE OR REPLACE FUNCTION public.prevent_last_super_admin_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  active_super_admins INTEGER;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.role = 'super_admin'
     AND OLD.is_active = TRUE
     AND (NEW.role <> 'super_admin' OR NEW.is_active = FALSE) THEN
    SELECT COUNT(*) INTO active_super_admins
    FROM public.system_users
    WHERE role = 'super_admin' AND is_active = TRUE;

    IF active_super_admins <= 1 THEN
      RAISE EXCEPTION 'Cannot deactivate or demote the last active super_admin.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_super_admin_removal ON public.system_users;
CREATE TRIGGER trg_prevent_last_super_admin_removal
BEFORE UPDATE ON public.system_users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_last_super_admin_removal();

-- 4) Controlled bootstrap path for creating/promoting the platform super_admin.
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin(
  p_email TEXT,
  p_full_name TEXT,
  p_supabase_uid UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_request_role TEXT := auth.role();
  v_existing_id UUID;
  v_normalized_email TEXT;
BEGIN
  v_normalized_email := LOWER(TRIM(p_email));

  IF v_normalized_email IS NULL OR v_normalized_email = '' THEN
    RAISE EXCEPTION 'bootstrap_super_admin: email is required.';
  END IF;

  IF p_full_name IS NULL OR TRIM(p_full_name) = '' THEN
    RAISE EXCEPTION 'bootstrap_super_admin: full_name is required.';
  END IF;

  IF p_supabase_uid IS NULL THEN
    RAISE EXCEPTION 'bootstrap_super_admin: supabase_uid is required.';
  END IF;

  -- Only service role or an existing super_admin can execute this safely.
  IF v_request_role <> 'service_role' AND NOT public.is_system_admin('super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: only service_role or active super_admin can bootstrap super admin.';
  END IF;

  INSERT INTO public.system_users (
    email,
    full_name,
    role,
    supabase_uid,
    is_active
  )
  VALUES (
    v_normalized_email,
    TRIM(p_full_name),
    'super_admin',
    p_supabase_uid,
    TRUE
  )
  ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = 'super_admin',
    supabase_uid = EXCLUDED.supabase_uid,
    is_active = TRUE
  RETURNING id INTO v_existing_id;

  RETURN v_existing_id;
END;
$$;
