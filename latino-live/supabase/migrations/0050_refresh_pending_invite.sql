-- An invitation that is still waiting must follow the room: if the room
-- became private after the invitation was sent, the code travels with it now.

create or replace function public.invite_to_room(p_room uuid, p_to_user uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  host uuid;
  slug text;
  title text;
  private_room boolean;
  code text;
  inviter text;
  invite_id uuid;
begin
  if uid is null then raise exception 'Inicia sesión para invitar'; end if;
  if p_to_user is null or p_to_user = uid then raise exception 'Elige a otra persona'; end if;

  select r.host_id, r.slug, r.title, coalesce(r.is_private, false)
    into host, slug, title, private_room
    from public.rooms r
   where r.id = p_room and r.closed_at is null;
  if slug is null then raise exception 'La sala ya no existe'; end if;

  -- The room's own people can invite; nobody else can use a room to reach
  -- strangers.
  if host <> uid and not exists (
    select 1 from public.room_seats s where s.room_id = p_room and s.user_id = uid
  ) then
    raise exception 'Solo quien está en la sala puede invitar';
  end if;

  if private_room then
    if host <> uid then raise exception 'Solo el anfitrión puede invitar a su sala privada'; end if;
    select c.code into code from public.room_join_codes c where c.room_id = p_room;
  end if;

  if not exists (select 1 from public.profiles where id = p_to_user) then
    raise exception 'Esa persona no existe';
  end if;

  inviter := public.my_display_name();

  select id into invite_id from public.room_invites
   where room_id = p_room and from_user_id = uid and to_user_id = p_to_user and status = 'pending'
   limit 1;
  if invite_id is not null then
    -- The invitation that was already sent follows the room as it is now.
    update public.room_invites
       set join_code = code, room_title = title, room_slug = slug, from_name = inviter
     where id = invite_id;
    return invite_id;
  end if;

  insert into public.room_invites (room_id, room_slug, room_title, from_user_id, from_name, to_user_id, join_code)
  values (p_room, slug, title, uid, inviter, p_to_user, code)
  returning id into invite_id;

  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (p_room, uid, inviter, 'system', inviter || ' invitó a alguien a la sala');

  return invite_id;
end;
$$;

grant execute on function public.invite_to_room(uuid, uuid) to authenticated;
