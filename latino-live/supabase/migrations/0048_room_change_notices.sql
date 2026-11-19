-- The room's chat says what changed: the host closing the room with a code, or
-- putting a padlock on a seat. Only real changes are announced, so toggling
-- twice never fills the chat with duplicates.

create or replace function public.set_room_private(p_room uuid, p_private boolean, p_code text default null)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  host uuid;
  was_private boolean;
  current_code text;
  new_code text;
begin
  if uid is null then raise exception 'Inicia sesión'; end if;
  select host_id, coalesce(is_private, false) into host, was_private from public.rooms where id = p_room;
  if host is null then raise exception 'La sala ya no existe'; end if;
  if host <> uid then raise exception 'Solo el dueño de la sala puede cambiarlo'; end if;

  if p_private then
    select c.code into current_code from public.room_join_codes c where c.room_id = p_room;
    new_code := coalesce(nullif(trim(p_code), ''), current_code, upper(substr(md5(random()::text), 1, 6)));
    insert into public.room_join_codes as c (room_id, code) values (p_room, new_code)
    on conflict (room_id) do update set code = excluded.code;
    update public.rooms set is_private = true where id = p_room;
    if not was_private then
      insert into public.room_messages (room_id, user_id, author, kind, body)
      values (p_room, uid, public.my_display_name(), 'system',
              'La sala ahora es privada: solo entra quien tenga el código');
    end if;
    return new_code;
  end if;

  delete from public.room_join_codes where room_id = p_room;
  update public.rooms set is_private = false where id = p_room;
  if was_private then
    insert into public.room_messages (room_id, user_id, author, kind, body)
    values (p_room, uid, public.my_display_name(), 'system',
            'La sala volvió a ser pública: ya aparece en la cartelera');
  end if;
  return null;
end;
$$;

create or replace function public.set_seat_lock(p_room uuid, p_seat integer, p_locked boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  host uuid;
  capacity integer;
  already_locked boolean;
begin
  if uid is null then raise exception 'Inicia sesión'; end if;
  select host_id, max_seats into host, capacity from public.rooms where id = p_room;
  if host is null then raise exception 'La sala ya no existe'; end if;
  if host <> uid then raise exception 'Solo el dueño de la sala puede cerrar asientos'; end if;
  if p_seat is null or p_seat < 1 or p_seat > capacity then
    raise exception 'Ese asiento no está disponible';
  end if;

  select exists (select 1 from public.room_seat_locks where room_id = p_room and seat_no = p_seat)
    into already_locked;

  if p_locked then
    if already_locked then return; end if;
    insert into public.room_seat_locks (room_id, seat_no, locked_by)
    values (p_room, p_seat, uid);
    -- A locked seat cannot stay taken.
    delete from public.room_seats where room_id = p_room and seat_no = p_seat;
    insert into public.room_messages (room_id, user_id, author, kind, body)
    values (p_room, uid, public.my_display_name(), 'system',
            'El anfitrión cerró el asiento ' || p_seat || ' con candado');
  else
    if not already_locked then return; end if;
    delete from public.room_seat_locks where room_id = p_room and seat_no = p_seat;
    insert into public.room_messages (room_id, user_id, author, kind, body)
    values (p_room, uid, public.my_display_name(), 'system',
            'El anfitrión abrió el asiento ' || p_seat);
  end if;
end;
$$;

grant execute on function public.set_room_private(uuid, boolean, text) to authenticated;
grant execute on function public.set_seat_lock(uuid, integer, boolean) to authenticated;
