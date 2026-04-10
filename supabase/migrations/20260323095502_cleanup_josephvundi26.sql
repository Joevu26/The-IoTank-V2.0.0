-- Cleanup: Remove legacy admin account that will be re-added later
DELETE FROM public.system_users WHERE email = 'josephvundi26@gmail.com';
DELETE FROM public.profiles WHERE email = 'josephvundi26@gmail.com';
DELETE FROM public.client_billing WHERE email = 'josephvundi26@gmail.com';
