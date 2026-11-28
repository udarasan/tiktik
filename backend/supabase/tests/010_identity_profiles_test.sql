-- M2 · identity: profiles table, sign-up trigger, privileges and RLS.
-- Asserts both what a user can see/change and what they cannot (RLS fails silently).
begin;
create extension if not exists pgtap with schema extensions;

select plan(33);

-- ---------------------------------------------------------------------------
-- Fixtures: auth users created as the database owner (as Supabase Auth would).
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{"full_name": "  Alice Doe  "}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob.smith@example.com', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com', jsonb_build_object('full_name', repeat('x', 150))),
  ('00000000-0000-0000-0000-00000000000d', 'dave@example.com', '{"full_name": "   "}');

-- Switch to a signed-in user the way PostgREST does.
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
select has_table('public', 'profiles', 'profiles table exists');
select col_is_pk('public', 'profiles', 'id', 'profiles.id is the primary key');
select fk_ok('public', 'profiles', 'id', 'auth', 'users', 'id', 'profiles.id references auth.users.id');
select col_not_null('public', 'profiles', 'full_name', 'full_name is required');
select col_default_is('public', 'profiles', 'time_zone', 'UTC', 'time_zone defaults to UTC');
select col_default_is('public', 'profiles', 'theme', 'system', 'theme defaults to system');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS is enabled on profiles'
);

-- ---------------------------------------------------------------------------
-- FR-AUTH-01: sign-up trigger creates the profile
-- ---------------------------------------------------------------------------
select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Alice Doe',
  'FR-AUTH-01 trigger copies full_name from sign-up metadata (trimmed)'
);
select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'bob.smith',
  'FR-AUTH-01 trigger falls back to the email local part when no name is given'
);
select is(
  (select char_length(full_name) from public.profiles where id = '00000000-0000-0000-0000-00000000000c'),
  100,
  'FR-AUTH-01 trigger truncates names longer than 100 characters'
);
select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000d'),
  'dave',
  'FR-AUTH-01 trigger treats a blank name as missing'
);
select is(
  (select row(time_zone, theme)::text from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  row('UTC', 'system')::text,
  'FR-AUTH-09 new profiles start with UTC and system theme'
);

-- ---------------------------------------------------------------------------
-- Privileges for browser roles
-- ---------------------------------------------------------------------------
select ok(not has_table_privilege('anon', 'public.profiles', 'select'), 'anon cannot read profiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'insert'), 'authenticated cannot insert profiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'delete'), 'authenticated cannot delete profiles');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'id', 'update'), 'profiles.id is immutable');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'created_at', 'update'), 'profiles.created_at is immutable');
select ok(
  not has_function_privilege('authenticated', 'private.handle_new_user()', 'execute'),
  'handle_new_user is not callable by signed-in users'
);

-- ---------------------------------------------------------------------------
-- FR-AUTH-08 RLS: Alice sees and edits only her own profile
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');

select results_eq(
  'select id from public.profiles',
  array['00000000-0000-0000-0000-00000000000a'::uuid],
  'FR-AUTH-08 a user sees only their own profile'
);
select is_empty(
  $$select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000b'$$,
  'FR-AUTH-08 a user cannot read another profile'
);

select lives_ok(
  $$update public.profiles
      set full_name = 'Alice D.', job_title = 'Designer', time_zone = 'Asia/Colombo', theme = 'dark'
    where id = '00000000-0000-0000-0000-00000000000a'$$,
  'FR-AUTH-08/09 a user can update their name, job title, time zone and theme'
);

-- Updating someone else's row silently affects zero rows; verify it really didn't change.
update public.profiles set full_name = 'Hacked' where id = '00000000-0000-0000-0000-00000000000b';

select throws_ok(
  $$update public.profiles set id = gen_random_uuid() where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null,
  'FR-AUTH-08 a user cannot change their profile id'
);
select throws_ok(
  $$insert into public.profiles (id, full_name) values (gen_random_uuid(), 'Mallory')$$,
  '42501', null,
  'a user cannot insert profiles directly'
);
select throws_ok(
  $$delete from public.profiles where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null,
  'a user cannot delete profiles directly'
);

-- Validation (CHECK / trigger → 23514 → VALIDATION_ERROR in toAppError)
select throws_ok(
  $$update public.profiles set full_name = '   ' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null,
  'FR-AUTH-08 name cannot be blank'
);
select throws_ok(
  $$update public.profiles set full_name = repeat('y', 101) where id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null,
  'FR-AUTH-08 name is at most 100 characters'
);
select throws_ok(
  $$update public.profiles set time_zone = 'Mars/Olympus' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null,
  'FR-AUTH-09 time zone must be a valid IANA id'
);
select throws_ok(
  $$update public.profiles set theme = 'neon' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null,
  'FR-AUTH-09 theme must be light, dark or system'
);
select throws_ok(
  $$update public.profiles set avatar_url = 'http://insecure.example.com/a.png' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null,
  'FR-AUTH-08 avatar URL must be https'
);

-- ---------------------------------------------------------------------------
-- Anonymous visitors
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
set local role anon;
select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles (permission denied)');
reset role;

-- ---------------------------------------------------------------------------
-- Results checked as the owner
-- ---------------------------------------------------------------------------
select is(
  (select row(full_name, job_title, time_zone, theme)::text from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  row('Alice D.', 'Designer', 'Asia/Colombo', 'dark')::text,
  'FR-AUTH-08/09 own profile update was saved'
);
select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'bob.smith',
  'FR-AUTH-08 another user''s profile was not changed'
);

delete from auth.users where id = '00000000-0000-0000-0000-00000000000b';
select is_empty(
  $$select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000b'$$,
  'deleting the auth user deletes the profile (cascade)'
);

select * from finish();
rollback;
