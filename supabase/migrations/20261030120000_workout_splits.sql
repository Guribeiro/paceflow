-- Parciais das corridas gravadas pelo GPS (Workout.splits / splitMeters em
-- src/domain/workout.ts): duração de cada parcial em segundos e o tamanho da
-- parcial em metros. As duas colunas vêm juntas ou ficam nulas.

alter table public.workouts
  add column splits double precision[],
  add column split_meters double precision;

alter table public.workouts
  add constraint workouts_splits_check check (
    (splits is null and split_meters is null)
    or (
      split_meters > 0
      and cardinality(splits) between 1 and 500
      and array_ndims(splits) = 1
      and array_position(splits, null) is null
      and 0 < all (splits)
    )
  );

comment on column public.workouts.splits is 'Duração de cada parcial (s), na ordem. Só em corridas gravadas pelo GPS.';
comment on column public.workouts.split_meters is 'Tamanho das parciais em metros (1000 ou uma milha).';
