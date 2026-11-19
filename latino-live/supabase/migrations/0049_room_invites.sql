-- A person in a room can invite another person of the app to that room.
-- The invitation shows up in the guest's notices and opens the room with one
-- tap, with the code already filled in when the room is private.

create table if not exists public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  room_slug text not null,
  room_title text not null,
  from_user_id uuid not null references auth.users (id) on delete cascade,
  from_name text not null,
  to_user_id uuid not null references auth.users (id) on delete cascade,
  join_code text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists room_invites_to_user on public.room_invites (to_user_id, created_at desc);

alter table public.room_invites enable row level security;

drop policy if exists room_invites_read on public.room_invites;
create policy room_invites_read on public.room_invites for select to authenticated
  using (to_user_id = auth.uid() or from_user_id = auth.uid());

drop policy if exists room_invites_insert on public.room_invites;
create policy room_invites_insert on public.room_invites for insert to authenticated
  with check (from_user_id = auth.uid());

drop policy if exists room_invites_update on public.room_invites;
create policy room_invites_update on public.room_invites for update to authenticated
  using (to_user_id = auth.uid() or from_user_id = auth.uid())
  with check (to_user_id = auth.uid() or from_user_id = auth.uid());

/**
 * The invitation itself. Only someone who is in the room can invite, and
 * only the host of a private room can hand out its code.
 */
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

  select id into invite_id from public.room_invites
   where room_id = p_room and from_user_id = uid and to_user_id = p_to_user and status = 'pending'
   limit 1;
  if invite_id is not null then return invite_id; end if;

  inviter := public.my_display_name();
  insert into public.room_invites (room_id, room_slug, room_title, from_user_id, from_name, to_user_id, join_code)
  values (p_room, slug, title, uid, inviter, p_to_user, code)
  returning id into invite_id;

  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (p_room, uid, inviter, 'system', inviter || ' invitó a alguien a la sala');

  return invite_id;
end;
$$;

grant execute on function public.invite_to_room(uuid, uuid) to authenticated;

-- The invitation reaches the guest without waiting for a refresh.
do $$
begin
  alter publication supabase_realtime add table public.room_invites;
exception
  when duplicate_object then null;
end $$;
