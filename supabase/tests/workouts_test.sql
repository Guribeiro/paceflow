-- Testes de RLS e do trigger de public.workouts. Rodar com: supabase test db
begin;
select plan(22);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'a@paceflow.test', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@paceflow.test', 'authenticated', 'authenticated');

-- Simula uma requisição autenticada: auth.uid() lê o "sub" do JWT.
create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Usuário A cria um treino
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');

select lives_ok(
  $$ insert into public.workouts (id, date, distance_meters, duration_seconds, terrain, rpe, note, created_at, updated_at)
     values ('w1', '2026-10-29 07:00+00', 5000, 1500, 'rua', 6, 'Leve', '2026-10-29 07:30+00', '2026-10-29 07:30+00') $$,
  'A insere o próprio treino'
);

select is(
  (select count(*)::int from public.workouts), 1,
  'A enxerga o próprio treino'
);

-- Tentar gravar em nome de B: o trigger força o dono para quem está autenticado
insert into public.workouts (user_id, id, date, distance_meters, duration_seconds, terrain, created_at, updated_at)
values ('22222222-2222-2222-2222-222222222222', 'spoof', '2026-10-29 08:00+00', 3000, 900, 'pista', now(), now());

select is(
  (select user_id from public.workouts where id = 'spoof'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'user_id enviado pelo cliente é ignorado: o dono é sempre auth.uid()'
);

select throws_ok(
  $$ delete from public.workouts where id = 'w1' $$,
  '42501', null,
  'delete não é permitido (exclusão é lógica)'
);

select throws_ok(
  $$ insert into public.workouts (id, date, distance_meters, duration_seconds, terrain, created_at, updated_at)
     values ('bad', now(), 1000, 300, 'trilha', now(), now()) $$,
  '23514', null,
  'terreno fora da lista é rejeitado'
);

select throws_ok(
  $$ insert into public.workouts (id, date, distance_meters, duration_seconds, terrain, created_at, updated_at)
     values ('a\b', now(), 1000, 300, 'rua', now(), now()) $$,
  '23514', null,
  'id fora do formato seguro é rejeitado'
);

-- Parciais (workouts_splits_check): as duas colunas juntas ou nenhuma
select lives_ok(
  $$ insert into public.workouts (id, date, distance_meters, duration_seconds, terrain, splits, split_meters, created_at, updated_at)
     values ('split-ok', now(), 3000, 915, 'rua', '{310, 305.4, 299.6}', 1000, now(), now()) $$,
  'parciais válidas são aceitas'
);

select throws_ok(
  $$ insert into public.workouts (id, date, distance_meters, duration_seconds, terrain, splits, created_at, updated_at)
     values ('split-only', now(), 3000, 915, 'rua', '{310}', now(), now()) $$,
  '23514', null,
  'parciais sem split_meters são rejeitadas'
);

select throws_ok(
  $$ insert into public.workouts (id, date, distance_meters, duration_seconds, terrain, split_meters, created_at, updated_at)
     values ('meters-only', now(), 3000, 915, 'rua', 1000, now(), now()) $$,
  '23514', null,
  'split_meters sem parciais é rejeitado'
);

select throws_ok(
  $$ insert into public.workouts (id, date, distance_meters, duration_seconds, terrain, splits, split_meters, created_at, updated_at)
     values ('split-empty', now(), 3000, 915, 'rua', '{}', 1000, now(), now()) $$,
  '23514', null,
  'lista de parciais vazia é rejeitada'
);

select throws_ok(
  $$ insert into public.workouts (id, date, distance_meters, duration_seconds, terrain, splits, split_meters, created_at, updated_at)
     values ('split-zero', now(), 3000, 915, 'rua', '{310, 0}', 1000, now(), now()) $$,
  '23514', null,
  'parcial igual a zero é rejeitada'
);

select throws_ok(
  $$ insert into public.workouts (id, date, distance_meters, duration_seconds, terrain, splits, split_meters, created_at, updated_at)
     values ('split-neg', now(), 3000, 915, 'rua', '{-5}', 1000, now(), now()) $$,
  '23514', null,
  'parcial negativa é rejeitada'
);

select throws_ok(
  $$ insert into public.workouts (id, date, distance_meters, duration_seconds, terrain, splits, split_meters, created_at, updated_at)
     values ('split-nan', now(), 3000, 915, 'rua', '{NaN}', 1000, now(), now()) $$,
  '23514', null,
  'parcial NaN é rejeitada'
);

select throws_ok(
  $$ insert into public.workouts (id, date, distance_meters, duration_seconds, terrain, splits, split_meters, created_at, updated_at)
     values ('split-inf', now(), 3000, 915, 'rua', '{310}', 'Infinity', now(), now()) $$,
  '23514', null,
  'split_meters infinito é rejeitado'
);

-- Usuário B não vê nem altera os treinos de A
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');

select is(
  (select count(*)::int from public.workouts), 0,
  'B não enxerga treinos de A'
);

update public.workouts set note = 'invadido', updated_at = '2030-01-01 00:00+00' where id = 'w1';

select pg_temp.act_as('11111111-1111-1111-1111-111111111111');

select is(
  (select note from public.workouts where id = 'w1'), 'Leve',
  'update de B não atinge o treino de A'
);

-- "A versão mais recente vence" no servidor
select pg_temp.as_admin();
create temp table before_update as
  select server_updated_at from public.workouts where id = 'w1';
grant select on before_update to authenticated;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');

update public.workouts set note = 'antiga', updated_at = '2026-10-29 07:00+00' where id = 'w1';

select is(
  (select note from public.workouts where id = 'w1'), 'Leve',
  'escrita com updated_at mais antigo é ignorada'
);

update public.workouts set note = 'empate', updated_at = '2026-10-29 07:30+00' where id = 'w1';

select is(
  (select note from public.workouts where id = 'w1'), 'Leve',
  'escrita com updated_at igual é ignorada'
);

insert into public.workouts (id, date, distance_meters, duration_seconds, terrain, note, created_at, updated_at)
values ('w1', '2026-10-29 07:00+00', 5000, 1500, 'rua', 'nova', '2000-01-01 00:00+00', '2026-10-29 09:00+00')
on conflict (user_id, id) do update set
  note = excluded.note,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

select is(
  (select note from public.workouts where id = 'w1'), 'nova',
  'upsert com updated_at mais recente vence'
);

select is(
  (select created_at from public.workouts where id = 'w1'), '2026-10-29 07:30+00'::timestamptz,
  'created_at original é preservado'
);

select ok(
  (select server_updated_at from public.workouts where id = 'w1') > (select server_updated_at from before_update),
  'server_updated_at avança a cada escrita'
);

-- Visitante sem login não lê nada
select pg_temp.as_admin();
set local role anon;

select throws_ok(
  $$ select * from public.workouts $$,
  '42501', null,
  'anon não tem acesso à tabela'
);

select * from finish();
rollback;
