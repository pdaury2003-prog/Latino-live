-- The host paints the room with their own photo, members send photos in the
-- chat, and the host or a moderator can clear the whole chat.

alter table public.rooms add column if not exists background_path text;
alter table public.room_messages add column if not exists image_path text;

alter table public.room_messages drop constraint if exists room_messages_kind_check;
alter table public.room_messages add constraint room_messages_kind_check
  check (kind in ('welcome', 'system', 'user', 'announcement', 'gift', 'photo'));
alter table public.room_messages drop constraint if exists room_messages_body_check;
alter table public.room_messages add constraint room_messages_body_check
  check (char_length(body) between 0 and 400);
alter table public.room_messages drop constraint if exists room_messages_content_check;
alter table public.room_messages add constraint room_messages_content_check
  check (char_length(body) >= 1 or image_path is not null);

create table if not exists public.room_moderators (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.room_moderators enable row level security;
drop policy if exists moderators_read on public.room_moderators;
create policy moderators_read on public.room_moderators for select to authenticated using (true);

-- Host or a moderator of this room.
create or replace function public.room_can_moderate(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.rooms r where r.id = p_room and r.host_id = auth.uid())
      or exists (select 1 from public.room_moderators m where m.room_id = p_room and m.user_id = auth.uid());
$$;

create or replace function public.set_room_moderator(p_room uuid, p_user uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target text;
begin
  if not exists (select 1 from public.rooms r where r.id = p_room and r.host_id = auth.uid()) then
    raise exception 'Solo el anfitrión puede nombrar moderadores';
  end if;
  if p_user = auth.uid() then raise exception 'El anfitrión ya modera la sala'; end if;
  if p_on then
    if not exists (select 1 from public.room_seats s where s.room_id = p_room and s.user_id = p_user) then
      raise exception 'Esa persona no está sentada en la sala';
    end if;
    insert into public.room_moderators (room_id, user_id, added_by)
    values (p_room, p_user, auth.uid())
    on conflict (room_id, user_id) do nothing;
    select display_name into target from public.room_seats where room_id = p_room and user_id = p_user;
    insert into public.room_messages (room_id, user_id, author, kind, body)
    values (p_room, auth.uid(), public.my_display_name(), 'system', target || ' ahora es moderador de la sala');
  else
    delete from public.room_moderators where room_id = p_room and user_id = p_user;
    select display_name into target from public.profiles where id = p_user;
    insert into public.room_messages (room_id, user_id, author, kind, body)
    values (p_room, auth.uid(), public.my_display_name(), 'system', coalesce(target, 'Un moderador') || ' dejó de ser moderador');
  end if;
end;
$$;

-- The host's own picture behind the room, or back to the built-in covers.
create or replace function public.set_room_background(p_room uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.rooms r where r.id = p_room and r.host_id = auth.uid()) then
    raise exception 'Solo el anfitrión puede cambiar el fondo';
  end if;
  if p_path is not null and p_path not like p_room::text || '/' || auth.uid()::text || '/%' then
    raise exception 'Ruta de imagen no válida';
  end if;
  update public.rooms set background_path = p_path where id = p_room;
end;
$$;

-- A photo in the room chat, announced to everyone.
create or replace function public.post_room_photo(p_room uuid, p_path text, p_caption text default '')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean text := left(btrim(coalesce(p_caption, '')), 300);
  seat public.room_seats;
  new_id bigint;
begin
  if uid is null then raise exception 'Inicia sesión para enviar una foto'; end if;
  if not exists (select 1 from public.rooms where id = p_room) then raise exception 'La sala ya no existe'; end if;
  select * into seat from public.room_seats where room_id = p_room and user_id = uid;
  if seat.user_id is not null and seat.muted then raise exception 'El anfitrión te ha silenciado'; end if;
  if p_path not like p_room::text || '/' || uid::text || '/%' then raise exception 'Ruta de imagen no válida'; end if;
  insert into public.room_messages (room_id, user_id, author, kind, body, image_path)
  values (p_room, uid, public.my_display_name(), 'photo', clean, p_path)
  returning id into new_id;
  return new_id;
end;
$$;

-- Clearing the chat leaves one system line so the room knows what happened.
create or replace function public.clear_room_chat(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.room_can_moderate(p_room) then raise exception 'Solo el anfitrión o un moderador pueden borrar el chat'; end if;
  delete from public.room_messages where room_id = p_room;
  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (p_room, auth.uid(), public.my_display_name(), 'system', 'El chat se borró por el anfitrión o un moderador');
end;
$$;

-- Moderators may mute and expel too, but never the host.
create or replace function public.moderate_member(p_room uuid, p_user uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target text;
  room_host uuid;
begin
  if not public.room_can_moderate(p_room) then raise exception 'Solo el anfitrión o un moderador pueden moderar'; end if;
  if p_user = auth.uid() then raise exception 'No puedes moderarte a ti mismo'; end if;
  select host_id into room_host from public.rooms where id = p_room;
  if p_user = room_host then raise exception 'No puedes moderar al anfitrión'; end if;
  select display_name into target from public.room_seats where room_id = p_room and user_id = p_user;
  if target is null then raise exception 'Esa persona ya no está en la sala'; end if;
  if p_action = 'mute' then
    update public.room_seats set muted = true, speaking = false where room_id = p_room and user_id = p_user;
    insert into public.room_messages (room_id, user_id, author, kind, body)
    values (p_room, auth.uid(), public.my_display_name(), 'system', target || ' fue silenciado por la moderación');
  elsif p_action = 'unmute' then
    update public.room_seats set muted = false, speaking = false where room_id = p_room and user_id = p_user;
    insert into public.room_messages (room_id, user_id, author, kind, body)
    values (p_room, auth.uid(), public.my_display_name(), 'system', target || ' fue activado por la moderación');
  elsif p_action = 'kick' then
    delete from public.room_seats where room_id = p_room and user_id = p_user;
    delete from public.room_moderators where room_id = p_room and user_id = p_user;
    insert into public.room_messages (room_id, user_id, author, kind, body)
    values (p_room, auth.uid(), public.my_display_name(), 'system', target || ' fue expulsado de la sala');
  else
    raise exception 'Acción desconocida';
  end if;
end;
$$;

-- Announcements stay host-only; clearing and moderating are the moderator's job.
create or replace function public.expand_room_seats(p_room uuid, p_seats integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_capacity integer := greatest(4, least(15, p_seats));
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

drop policy if exists room_photo_read on storage.objects;
create policy room_photo_read on storage.objects
  for select to authenticated
  using (bucket_id = 'room-photos');

drop policy if exists room_photo_insert_own on storage.objects;
create policy room_photo_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'room-photos'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (select 1 from public.rooms r where r.id::text = (storage.foldername(name))[1])
  );

drop policy if exists room_photo_delete_own on storage.objects;
create policy room_photo_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'room-photos' and (storage.foldername(name))[2] = auth.uid()::text);

grant execute on function public.room_can_moderate(uuid) to authenticated;
grant execute on function public.set_room_moderator(uuid, uuid, boolean) to authenticated;
grant execute on function public.set_room_background(uuid, text) to authenticated;
grant execute on function public.post_room_photo(uuid, text, text) to authenticated;
grant execute on function public.clear_room_chat(uuid) to authenticated;

alter publication supabase_realtime add table public.room_moderators;
