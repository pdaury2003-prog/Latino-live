-- A video room can also sit six people: the camera square of six is a common
-- shape for a small watch party, and the room's notice should name it.

create or replace function public.set_room_video(p_room uuid, p_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  raw text := btrim(coalesce(p_url, ''));
  found_id text;
  clean text;
begin
  if not public.room_can_moderate(p_room) then
    raise exception 'Solo el anfitrión o un moderador cambia la sala a video';
  end if;
  if raw = '' then raise exception 'Pega el enlace del video de YouTube'; end if;
  -- youtu.be/ID, watch?v=ID, /embed/ID, /shorts/ID or a bare id.
  found_id := (regexp_match(raw, '(?:youtu\.be/|v=|/embed/|/shorts/|/live/)([A-Za-z0-9_-]{11})'))[1];
  if found_id is null then
    found_id := (regexp_match(raw, '^([A-Za-z0-9_-]{11})$'))[1];
  end if;
  if found_id is null then raise exception 'Ese enlace de YouTube no es válido'; end if;
  clean := 'https://www.youtube.com/watch?v=' || found_id;

  update public.rooms set video_url = clean where id = p_room;
  -- Watching keeps the room calm: ten seats are the most a video room needs.
  update public.rooms set max_seats = 10 where id = p_room and max_seats > 10;
  delete from public.room_seats where room_id = p_room and seat_no > 10;
  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (p_room, auth.uid(), public.my_display_name(), 'system',
          'La sala pasó a modo video de YouTube con 4, 6, 8 o 10 asientos de audio');
end;
$$;

grant execute on function public.set_room_video(uuid, text) to authenticated;
