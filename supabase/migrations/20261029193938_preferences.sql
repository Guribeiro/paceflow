-- Preferências que acompanham a conta (src/domain/preferences.ts): um registro
-- por usuário. O tema não entra: é por aparelho.

create table public.preferences (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (id = 'preferences'),
  unit text not null check (unit in ('km', 'mi')),
  weekly_goal_meters double precision check (weekly_goal_meters > 0),
  -- Validada também no app (parseRaceGoal); aqui só o formato básico.
  race_goal jsonb check (race_goal is null or jsonb_typeof(race_goal) = 'object'),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

comment on table public.preferences is 'Preferências sincronizadas do PaceFlow (unidade, meta semanal, prova-alvo).';

-- Mesma regra das outras tabelas: dono = auth.uid(), carimbo do servidor e
-- "a versão mais recente vence".
create trigger preferences_before_write
before insert or update on public.preferences
for each row execute function public.workouts_before_write();

alter table public.preferences enable row level security;
alter table public.preferences force row level security;

revoke all on table public.preferences from anon, authenticated;
grant select, insert, update on table public.preferences to authenticated;

create policy "preferences_select_own" on public.preferences
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "preferences_insert_own" on public.preferences
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "preferences_update_own" on public.preferences
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
