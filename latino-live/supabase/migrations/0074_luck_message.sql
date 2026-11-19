-- Posts a luck line (a dice roll or a seat draw) as its own kind of message,
-- so every phone in the room draws it differently from talk. The body is
-- plain text written by this function's caller; the room and the author come
-- from the call itself, never from the text.

create or replace function public.post_room_luck(p_room uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean text := left(btrim(coalesce(p_body, '')), 200);
begin
  if uid is null then raise exception 'Inicia sesion para jugar';
  end if;
  if clean = '' then return; end if;
  if not exists (select 1 from public.rooms where id = p_room) then
    raise exception 'La sala ya no existe';
  end if;
  -- A person has to be in the room to draw a seat: the message is a fact
  -- about the room, not a broadcast anyone can post from outside.
  if not exists (select 1 from public.room_seats where room_id = p_room and user_id = uid) then
    raise exception 'Sientate en un asiento para jugar';
  end if;
  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (p_room, uid, public.my_display_name(), 'luck', clean);
end;
$$;

grant execute on function public.post_room_luck(uuid, text) to authenticated;
