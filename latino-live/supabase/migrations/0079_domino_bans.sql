-- A suspended account must not keep playing a table it was already sitting at.
-- The domino functions write as the definer, so row policies do not see the
-- caller; a trigger does, and it asks the same check every other write uses.

create or replace function public.domino_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    perform public.assert_account_active();
  end if;
  return new;
end;
$$;

revoke all on function public.domino_guard() from public, anon, authenticated;

drop trigger if exists domino_guard_players on public.domino_players;
create trigger domino_guard_players
  before insert or update on public.domino_players
  for each row execute function public.domino_guard();

drop trigger if exists domino_guard_hands on public.domino_hands;
create trigger domino_guard_hands
  before insert or update on public.domino_hands
  for each row execute function public.domino_guard();

drop trigger if exists domino_guard_tables on public.domino_tables;
create trigger domino_guard_tables
  before insert or update on public.domino_tables
  for each row execute function public.domino_guard();
