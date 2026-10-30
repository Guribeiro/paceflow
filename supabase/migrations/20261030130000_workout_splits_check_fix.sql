-- Corrige workouts_splits_check (20261030120000): um CHECK só rejeita FALSE, e
-- com uma das colunas nula a expressão dava NULL e a linha passava. NaN e
-- Infinity também passavam (no Postgres, NaN é maior que qualquer número).

alter table public.workouts drop constraint workouts_splits_check;

alter table public.workouts
  add constraint workouts_splits_check check (
    (splits is null and split_meters is null)
    or (
      splits is not null
      and split_meters is not null
      and split_meters > 0
      and split_meters < 'Infinity'
      and cardinality(splits) between 1 and 500
      and array_ndims(splits) = 1
      and array_position(splits, null) is null
      and 0 < all (splits)
      and 'Infinity' > all (splits)
    )
  );
