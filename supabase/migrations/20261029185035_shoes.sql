-- Tênis do usuário (src/domain/shoe.ts) e o tênis usado em cada treino.

create table public.shoes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9-]{1,64}$'),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  initial_meters double precision not null default 0 check (initial_meters >= 0),
  limit_meters double precision not null check (limit_meters > 0),
  retired_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

comment on table public.shoes is 'Tênis do PaceFlow. Exclusão é lógica (deleted_at).';

create index shoes_user_server_updated_at_idx on public.shoes (user_id, server_updated_at);

-- Mesma regra dos treinos: dono = auth.uid(), carimbo do servidor e "a versão
-- mais recente vence". A função só usa colunas comuns às duas tabelas.
create trigger shoes_before_write
before insert or update on public.shoes
for each row execute function public.workouts_before_write();

alter table public.shoes enable row level security;
alter table public.shoes force row level security;

revoke all on table public.shoes from anon, authenticated;
grant select, insert, update on table public.shoes to authenticated;

create policy "shoes_select_own" on public.shoes
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "shoes_insert_own" on public.shoes
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "shoes_update_own" on public.shoes
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Tênis usado no treino. Sem chave estrangeira: o treino pode chegar ao
-- servidor antes do tênis, e o app tolera um tênis desconhecido.
alter table public.workouts
  add column shoe_id text check (shoe_id ~ '^[A-Za-z0-9-]{1,64}$');
