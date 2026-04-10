-- 1. Link or Create the Super Admin in system_users
-- system_users has UNIQUE(email) so ON CONFLICT works here
DO $$
BEGIN
  -- Local dev can run before the auth user exists; avoid hard-failing `supabase start`.
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'auth'
      AND table_name = 'users'
  )
  AND EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = '4d297d9b-c1a2-4bff-9399-8b0b20e88156'::uuid
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'system_users'
        AND column_name = 'firebase_uid'
    ) THEN
      INSERT INTO public.system_users (email, full_name, role, supabase_uid, firebase_uid, is_active)
      VALUES (
          'josezvundi@gmail.com',
          'Joseph Vundi',
          'super_admin',
          '4d297d9b-c1a2-4bff-9399-8b0b20e88156',
          'sb_4d297d9b-c1a2-4bff-9399-8b0b20e88156',
          true
      )
      ON CONFLICT (email) DO UPDATE SET
          supabase_uid = EXCLUDED.supabase_uid,
          firebase_uid = EXCLUDED.firebase_uid,
          role = 'super_admin',
          is_active = true;
    ELSE
      INSERT INTO public.system_users (email, full_name, role, supabase_uid, is_active)
      VALUES (
          'josezvundi@gmail.com',
          'Joseph Vundi',
          'super_admin',
          '4d297d9b-c1a2-4bff-9399-8b0b20e88156',
          true
      )
      ON CONFLICT (email) DO UPDATE SET
          supabase_uid = EXCLUDED.supabase_uid,
          role = 'super_admin',
          is_active = true;
    END IF;
  ELSE
    RAISE NOTICE 'Skipping system_users super_admin link: auth.users record not present yet';
  END IF;
END
$$;

-- 2. Link or Create the corresponding profile
-- profiles might NOT have UNIQUE(email), so we use a DO block
DO $$
BEGIN
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'auth'
        AND table_name = 'users'
    )
    AND EXISTS (
      SELECT 1
      FROM auth.users
      WHERE id = '4d297d9b-c1a2-4bff-9399-8b0b20e88156'::uuid
    ) THEN
      IF EXISTS (SELECT 1 FROM public.profiles WHERE email = 'josezvundi@gmail.com') THEN
          UPDATE public.profiles SET
              supabase_uid = '4d297d9b-c1a2-4bff-9399-8b0b20e88156',
              role = 'admin' -- Level 5 for client app access
          WHERE email = 'josezvundi@gmail.com';
      ELSE
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'profiles'
              AND column_name = 'firebase_uid'
          ) THEN
            INSERT INTO public.profiles (email, display_name, role, supabase_uid, firebase_uid)
            VALUES (
                'josezvundi@gmail.com',
                'Joseph Vundi',
                'admin',
                '4d297d9b-c1a2-4bff-9399-8b0b20e88156',
                'sb_4d297d9b-c1a2-4bff-9399-8b0b20e88156'
            );
          ELSE
            INSERT INTO public.profiles (email, display_name, role, supabase_uid)
            VALUES (
                'josezvundi@gmail.com',
                'Joseph Vundi',
                'admin',
                '4d297d9b-c1a2-4bff-9399-8b0b20e88156'
            );
          END IF;
      END IF;
    ELSE
      RAISE NOTICE 'Skipping profiles super_admin link: auth.users record not present yet';
    END IF;
END $$;
