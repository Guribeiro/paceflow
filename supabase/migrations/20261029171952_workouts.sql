-- Histórico de treinos sincronizado a partir do app (fonte de verdade: o MMKV
-- do aparelho). Espelha o tipo Workout de src/domain/workout.ts em snake_case.

create table public.workouts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Gerado no app; o mesmo formato aceito por parseWorkoutRecord.
  id text not null check (id ~ '^[A-Za-z0-9-]{1,64}$'),
  date timestamptz not null,
  distance_meters double precision not null check (distance_meters > 0),
  duration_seconds double precision not null check (duration_seconds > 0),
  terrain text not null check (terrain in ('rua', 'pista', 'esteira')),
  rpe smallint check (rpe between 1 and 10),
  note text check (char_length(note) <= 280),
  -- Timestamps do app: updated_at decide conflitos ("a versão mais recente vence").
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  -- Relógio do servidor, usado como cursor do pull (independe do relógio do celular).
  server_updated_at timestamptz not null default clock_timestamp(),
  -- Composta: ids iguais de usuários diferentes nunca colidem.
  primary key (user_id, id)
);

comment on table public.workouts is 'Treinos do PaceFlow. Exclusão é lógica (deleted_at).';

create index workouts_user_server_updated_at_idx on public.workouts (user_id, server_updated_at);

-- Antes de gravar: o dono é sempre quem está autenticado, o servidor carimba
-- server_updated_at, e uma escrita com updated_at igual ou mais antigo que o
-- atual é ignorada (mesma regra de WorkoutRepository.importWorkouts).
create function public.workouts_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  new.server_updated_at := clock_timestamp();

  if tg_op = 'UPDATE' then
    if new.updated_at <= old.updated_at then
      return null;
    end if;
    new.created_at := old.created_at;
  end if;

  return new;
end;
$$;

create trigger workouts_before_write
before insert or update on public.workouts
for each row execute function public.workouts_before_write();

-- RLS: cada usuário só enxerga e escreve as próprias linhas. Sem política de
-- delete: a exclusão é lógica, via update de deleted_at.
alter table public.workouts enable row level security;
alter table public.workouts force row level security;

-- O Supabase concede tudo a anon/authenticated por padrão em public; revoga e
-- concede só o necessário (sem delete/truncate, mesmo com o RLS barrando).
revoke all on table public.workouts from anon, authenticated;
grant select, insert, update on table public.workouts to authenticated;

create policy "workouts_select_own" on public.workouts
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "workouts_insert_own" on public.workouts
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "workouts_update_own" on public.workouts
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
