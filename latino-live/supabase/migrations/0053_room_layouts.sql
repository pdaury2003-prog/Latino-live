-- A room can wear one of the designs the owner drew: the host picks it and
-- every phone draws the same square, with the same seat numbers on the same
-- places. Older builds ignore the column and keep their grid, so they keep
-- working; the seats are the same seats either way.

alter table public.rooms add column if not exists layout text;

create or replace function public.set_room_layout(p_room uuid, p_layout text, p_seats integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_capacity integer := greatest(4, least(20, coalesce(p_seats, 12)));
  occupied integer;
  clean text := nullif(btrim(coalesce(p_layout, '')), '');
begin
  if not public.room_is_host(p_room) then raise exception 'Solo el anfitrión puede cambiar el diseño'; end if;
  if clean is not null and clean not in (
    'classic', 'neon', 'stage', 'diamond', 'galaxy', 'circle', 'heart', 'amphitheater', 'teams'
  ) then
    raise exception 'Ese diseño no existe';
  end if;
  select count(*) into occupied from public.room_seats where room_id = p_room;
  if occupied > next_capacity then
    raise exception 'Hay % personas sentadas y este diseño tiene % lugares', occupied, next_capacity;
  end if;
  update public.rooms set layout = clean, max_seats = next_capacity where id = p_room;
end;
$$;

grant execute on function public.set_room_layout(uuid, text, integer) to authenticated;
