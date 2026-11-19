-- The podium notice should also arrive when the room climbs without sending
-- anything: a room above it closing frees a place, and the room that takes it
-- hears about it. The notice is still written once per better place each day.

create or replace function public.announce_podium_after_close()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Only a closing changes the board this way; a new room starts at zero.
  if new.closed_at is null or old.closed_at is not null then return new; end if;
  perform public.announce_podium(r.id)
    from public.rooms r
   where r.closed_at is null
     and r.id <> new.id;
  return new;
end;
$$;

drop trigger if exists podium_after_close on public.rooms;
create trigger podium_after_close
  after update of closed_at on public.rooms
  for each row execute function public.announce_podium_after_close();
