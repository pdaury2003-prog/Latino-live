-- Cambiar de asiento es una sola operación: o se suelta el asiento anterior y
-- el nuevo queda ocupado, o no cambia nada.
--
-- Antes, dos toques seguidos (o dos teléfonos con la misma cuenta) podían
-- chocar contra el índice único (room_id, user_id) y el teléfono mostraba el
-- error técnico de la base en vez de una frase clara. Además, mover de asiento
-- borraba el silencio que el anfitrión había puesto a esa persona.

create or replace function public.take_seat(p_room uuid, p_seat integer)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  capacity integer;
  taken uuid;
  previous record;
  previous_title text;
  my_seat integer;
  was_muted boolean := false;
begin
  if uid is null then raise exception 'Inicia sesión para ocupar un asiento'; end if;
  select max_seats into capacity from public.rooms where id = p_room;
  if capacity is null then raise exception 'La sala ya no existe'; end if;
  perform public.assert_not_banned(p_room);
  if p_seat is null or p_seat < 1 or p_seat > capacity then
    raise exception 'Ese asiento no está disponible';
  end if;

  -- Una cuenta mueve un asiento a la vez: un segundo toque espera su turno en
  -- vez de pisar el primero. Y un asiento se toma de uno en uno, para que el
  -- que llega segundo reciba el aviso y no un error de índice.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_room::text || ':' || p_seat::text, 0));

  if exists (select 1 from public.room_seat_locks where room_id = p_room and seat_no = p_seat) then
    raise exception 'Ese asiento tiene candado';
  end if;

  -- Mi asiento actual: su silencio viaja conmigo al asiento nuevo.
  select seat_no, muted into my_seat, was_muted
    from public.room_seats
   where room_id = p_room and user_id = uid;

  -- Ya estoy sentado ahí: no hay nada que mover.
  if my_seat = p_seat then return null; end if;

  select user_id into taken from public.room_seats where room_id = p_room and seat_no = p_seat;
  if taken is not null and taken <> uid then raise exception 'Ese asiento está ocupado'; end if;

  begin
    delete from public.room_seats where room_id = p_room and user_id = uid;
    insert into public.room_seats (room_id, seat_no, user_id, display_name, avatar_url, muted, speaking)
    values (
      p_room, p_seat, uid, public.my_display_name(),
      (select avatar_url from public.profiles where id = uid),
      coalesce(was_muted, false), false
    );
  exception
    when unique_violation then
      -- Alguien ganó el asiento en el mismo instante. El bloque deshace el
      -- borrado, así que la persona se queda donde estaba y solo ve el aviso.
      raise exception 'Ese asiento acaba de ocuparse';
  end;

  -- Una cuenta vive en una sola sala: los asientos que quedaron en otras salas
  -- se sueltan y la sala que la pierde lo dice en su chat.
  for previous in
    select s.room_id, r.title
      from public.room_seats s
      join public.rooms r on r.id = s.room_id
     where s.user_id = uid and s.room_id <> p_room
  loop
    delete from public.room_seats where room_id = previous.room_id and user_id = uid;
    insert into public.room_messages (room_id, user_id, author, kind, body)
    values (previous.room_id, uid, public.my_display_name(), 'system',
            public.my_display_name() || ' entró en otra sala');
    previous_title := previous.title;
  end loop;

  return previous_title;
end;
$$;

grant execute on function public.take_seat(uuid, integer) to authenticated;
