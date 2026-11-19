-- Rooms can hold up to 20 seats, so a busy night has room for everyone.

alter table public.rooms drop constraint if exists rooms_max_seats_check;
alter table public.rooms
  add constraint rooms_max_seats_check check (max_seats between 4 and 20);

alter table public.room_seats drop constraint if exists room_seats_seat_no_check;
alter table public.room_seats
  add constraint room_seats_seat_no_check check (seat_no between 1 and 20);

create or replace function public.expand_room_seats(p_room uuid, p_seats integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_capacity integer := greatest(4, least(20, p_seats));
begin
  if not exists (select 1 from public.rooms r where r.id = p_room and r.host_id = auth.uid()) then
    raise exception 'Solo el anfitrión puede cambiar los asientos';
  end if;
  update public.rooms set max_seats = next_capacity where id = p_room;
  delete from public.room_seats where room_id = p_room and seat_no > next_capacity;
  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (p_room, auth.uid(), public.my_display_name(), 'system', 'El anfitrión puso la sala en ' || next_capacity || ' asientos');
end;
$$;
grant execute on function public.expand_room_seats(uuid, integer) to authenticated;
