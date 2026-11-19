-- Lets a signed-in student delete their own account and everything stored under it.
-- Every table that holds student data references auth.users with "on delete cascade", so
-- removing the user row removes questions, sessions, notes, cards and the profile with it.
-- The function only ever acts on the caller (auth.uid()); it takes no arguments.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
