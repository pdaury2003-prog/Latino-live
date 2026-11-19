-- Each moderator carries a bubble colour in the room chat: rose, blue or red,
-- chosen by the host, drawn at 70% opacity.

alter table public.room_moderators
  add column if not exists bubble_color text not null default 'rose';

alter table public.room_moderators drop constraint if exists room_moderators_bubble_check;
alter table public.room_moderators
  add constraint room_moderators_bubble_check check (bubble_color in ('rose', 'blue', 'red'));

create or replace function public.set_moderator_bubble(p_room uuid, p_user uuid, p_color text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.rooms r where r.id = p_room and r.host_id = auth.uid()) then
    raise exception 'Solo el anfitrión puede cambiar los colores de sus moderadores';
  end if;
  if p_color not in ('rose', 'blue', 'red') then
    raise exception 'Ese color no existe';
  end if;
  update public.room_moderators
     set bubble_color = p_color
   where room_id = p_room and user_id = p_user;
  if not found then
    raise exception 'Esa persona no es moderadora';
  end if;
end;
$$;
grant execute on function public.set_moderator_bubble(uuid, uuid, text) to authenticated;

/** The bubble colour each moderator wears, for the room chat. */
create or replace function public.room_moderator_colors(p_room uuid)
returns table (user_id uuid, bubble_color text)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, m.bubble_color from public.room_moderators m where m.room_id = p_room;
$$;
grant execute on function public.room_moderator_colors(uuid) to authenticated;
