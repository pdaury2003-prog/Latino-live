-- The host writes the words shown at the top of the room: the room name
-- becomes theirs to change while everyone else sees it at once.
create or replace function public.set_room_title(p_room uuid, p_title text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean text := left(btrim(coalesce(p_title, '')), 60);
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if not public.room_is_host(p_room) then
    raise exception 'Solo el anfitrión cambia el nombre de la sala';
  end if;
  if clean = '' then raise exception 'El nombre de la sala no puede quedar vacío'; end if;
  update public.rooms set title = clean where id = p_room;
end;
$$;
grant execute on function public.set_room_title(uuid, text) to authenticated;
