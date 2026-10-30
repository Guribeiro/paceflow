-- Exclusão da conta pelo próprio usuário (exigência da Google Play). Apaga o
-- usuário de auth.users; treinos, tênis e preferências saem em cascata
-- (on delete cascade nas três tabelas).
create function public.delete_own_account() returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'sem sessão' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
