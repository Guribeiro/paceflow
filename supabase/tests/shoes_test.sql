-- Testes de RLS e do trigger de public.shoes e do shoe_id em workouts. Rodar com: supabase test db
begin;
select plan(9);

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
  $$ insert into public.shoes (id, name, initial_meters, limit_meters, created_at, updated_at)
     values ('s1', 'Pegasus', 120000, 700000, '2026-10-01 10:00+00', '2026-10-01 10:00+00') $$,
  'A cadastra um tênis'
);

select throws_ok(
  $$ insert into public.shoes (id, name, limit_meters, created_at, updated_at)
     values ('s2', '   ', 700000, now(), now()) $$,
  '23514', null,
  'nome vazio é rejeitado'
);

select throws_ok(
  $$ insert into public.shoes (id, name, limit_meters, created_at, updated_at)
     values ('s3', 'X', 0, now(), now()) $$,
  '23514', null,
  'limite zero é rejeitado'
);

select throws_ok(
  $$ delete from public.shoes where id = 's1' $$,
  '42501', null,
  'delete não é permitido (exclusão é lógica)'
);

update public.shoes set name = 'antigo', updated_at = '2026-09-01 00:00+00' where id = 's1';
select is((select name from public.shoes where id = 's1'), 'Pegasus', 'escrita mais antiga é ignorada');

update public.shoes set name = 'Pegasus 41', updated_at = '2026-10-02 00:00+00' where id = 's1';
select is((select name from public.shoes where id = 's1'), 'Pegasus 41', 'escrita mais recente vence');

select lives_ok(
  $$ insert into public.workouts (id, date, distance_meters, duration_seconds, terrain, shoe_id, created_at, updated_at)
     values ('w1', now(), 5000, 1500, 'rua', 's1', now(), now()) $$,
  'treino aceita shoe_id (sem exigir que o tênis já exista no servidor)'
);

select throws_ok(
  $$ insert into public.workouts (id, date, distance_meters, duration_seconds, terrain, shoe_id, created_at, updated_at)
     values ('w2', now(), 5000, 1500, 'rua', 'a\b', now(), now()) $$,
  '23514', null,
  'shoe_id fora do formato seguro é rejeitado'
);

select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.shoes), 0, 'B não enxerga os tênis de A');

select * from finish();
rollback;
