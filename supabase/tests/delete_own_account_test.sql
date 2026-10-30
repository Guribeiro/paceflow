-- Testes de public.delete_own_account. Rodar com: supabase test db
begin;
select plan(6);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'a@paceflow.test', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@paceflow.test', 'authenticated', 'authenticated');

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- O trigger grava user_id = auth.uid(): cada um insere as próprias preferências.
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
insert into public.preferences (id, unit, created_at, updated_at) values ('preferences', 'km', now(), now());
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
insert into public.preferences (id, unit, created_at, updated_at) values ('preferences', 'km', now(), now());
reset role;

set local role anon;
select throws_ok($$ select public.delete_own_account() $$, '42501', null, 'anon não pode chamar');
reset role;

select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select lives_ok($$ select public.delete_own_account() $$, 'A exclui a própria conta');
reset role;

select is((select count(*)::int from auth.users where id = '11111111-1111-1111-1111-111111111111'), 0, 'A sumiu de auth.users');
select is((select count(*)::int from public.preferences where user_id = '11111111-1111-1111-1111-111111111111'), 0, 'dados de A saem em cascata');
select is((select count(*)::int from auth.users where id = '22222222-2222-2222-2222-222222222222'), 1, 'B continua');
select is((select count(*)::int from public.preferences where user_id = '22222222-2222-2222-2222-222222222222'), 1, 'dados de B continuam');

select * from finish();
rollback;
