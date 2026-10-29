-- Testes de RLS e do trigger de public.preferences. Rodar com: supabase test db
begin;
select plan(7);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'a@paceflow.test', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@paceflow.test', 'authenticated', 'authenticated');

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

select pg_temp.act_as('11111111-1111-1111-1111-111111111111');

select lives_ok(
  $$ insert into public.preferences (id, unit, weekly_goal_meters, race_goal, created_at, updated_at)
     values ('preferences', 'km', 20000, '{"distanceKm": 21.0975, "date": "2026-11-23"}', '2026-10-01 10:00+00', '2026-10-01 10:00+00') $$,
  'A grava as preferências'
);

select throws_ok(
  $$ insert into public.preferences (id, unit, created_at, updated_at) values ('outra', 'km', now(), now()) $$,
  '23514', null,
  'só existe o registro "preferences"'
);

select throws_ok(
  $$ update public.preferences set unit = 'léguas', updated_at = '2030-01-01 00:00+00' $$,
  '23514', null,
  'unidade inválida é rejeitada'
);

update public.preferences set unit = 'mi', updated_at = '2026-09-01 00:00+00';
select is((select unit from public.preferences), 'km', 'escrita mais antiga é ignorada');

update public.preferences set unit = 'mi', updated_at = '2026-10-02 00:00+00';
select is((select unit from public.preferences), 'mi', 'escrita mais recente vence');

select throws_ok(
  $$ delete from public.preferences $$,
  '42501', null,
  'delete não é permitido'
);

select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.preferences), 0, 'B não enxerga as preferências de A');

select * from finish();
rollback;
