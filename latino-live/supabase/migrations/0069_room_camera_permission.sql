-- The host decides whether the room shows cameras at all. A room opens with
-- them allowed, the way it always worked, and the host can close them for a
-- night where the room is only for voices.

alter table public.rooms
  add column if not exists allow_camera boolean not null default true;

create or replace function public.set_room_camera(p_room uuid, p_allow boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean := coalesce(p_allow, true);
begin
  if not public.room_can_moderate(p_room) then
    raise exception 'Solo el anfitrión o un moderador cambia las cámaras';
  end if;
  update public.rooms set allow_camera = allowed where id = p_room;
  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (
    p_room,
    auth.uid(),
    public.my_display_name(),
    'system',
    case when allowed
      then 'El anfitrión activó las cámaras de la sala'
      else 'El anfitrión desactivó las cámaras de la sala'
    end
  );
  return allowed;
end;
$$;

grant execute on function public.set_room_camera(uuid, boolean) to authenticated;
