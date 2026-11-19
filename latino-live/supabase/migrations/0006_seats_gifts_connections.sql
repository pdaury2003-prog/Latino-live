-- Rooms hold 4 to 15 seats; gifts can go to one person; the profile reads real
-- follower and friend lists.

alter table public.rooms drop constraint if exists rooms_max_seats_check;
update public.rooms set max_seats = least(15, greatest(4, max_seats));
alter table public.rooms add constraint rooms_max_seats_check check (max_seats between 4 and 15);
alter table public.rooms alter column max_seats set default 8;

alter table public.room_seats drop constraint if exists room_seats_seat_no_check;
alter table public.room_seats add constraint room_seats_seat_no_check check (seat_no between 1 and 15);

create or replace function public.expand_room_seats(p_room uuid, p_seats integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_capacity integer := greatest(4, least(15, p_seats));
begin
  if not public.room_is_host(p_room) then raise exception 'Solo el anfitrión puede cambiar los asientos'; end if;
  update public.rooms set max_seats = next_capacity where id = p_room;
  delete from public.room_seats where room_id = p_room and seat_no > next_capacity;
  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (p_room, auth.uid(), public.my_display_name(), 'system', 'El anfitrión puso la sala en ' || next_capacity || ' asientos');
end;
$$;

-- A new room starts with 8 seats; the host moves it between 4 and 15.
create or replace function public.open_room(p_title text, p_cover text default 'palace', p_country text default 'US')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  clean text;
begin
  if uid is null then raise exception 'Inicia sesión para abrir una sala'; end if;
  clean := left(coalesce(nullif(btrim(p_title), ''), 'Mi sala'), 60);
  insert into public.rooms (slug, title, host_id, host_name, country, cover, max_seats)
  values (
    lower(regexp_replace(clean, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6),
    clean,
    uid,
    public.my_display_name(),
    case when p_country in ('US', 'ES', 'MX', 'AR', 'CO') then p_country else 'US' end,
    case when p_cover in ('palace', 'pool', 'terrace') then p_cover else 'palace' end,
    8
  )
  returning id into new_id;
  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (new_id, uid, public.my_display_name(), 'welcome', 'Bienvenido a la sala. Respeta a los demás. Nada de contenido para adultos, apuestas ni política.');
  return new_id;
end;
$$;

alter table public.room_gifts add column if not exists recipient_id uuid references auth.users (id) on delete set null;
alter table public.room_gifts add column if not exists recipient_name text;

-- Gifts can name one person in the room; that person receives the gold.
create or replace function public.send_gift_to(p_room uuid, p_gift text, p_recipient uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gift public.gift_catalog;
  balance integer;
  sender text;
  target text;
  host uuid;
  payee uuid;
begin
  if uid is null then raise exception 'Inicia sesión para enviar un regalo'; end if;
  select * into gift from public.gift_catalog where key = p_gift;
  if gift.key is null then raise exception 'Ese regalo no existe'; end if;
  if not exists (select 1 from public.rooms where id = p_room) then raise exception 'La sala ya no existe'; end if;

  if p_recipient is not null then
    if p_recipient = uid then raise exception 'No puedes regalarte a ti mismo'; end if;
    select display_name into target from public.room_seats where room_id = p_room and user_id = p_recipient;
    if target is null then raise exception 'Esa persona ya no está en la sala'; end if;
  end if;

  update public.profiles set diamonds = diamonds - gift.cost
  where id = uid and diamonds >= gift.cost
  returning diamonds, display_name into balance, sender;
  if balance is null then raise exception 'No tienes suficientes diamantes'; end if;

  if p_recipient is not null then
    payee := p_recipient;
  else
    select host_id into payee from public.rooms where id = p_room;
  end if;

  if payee is not null and payee <> uid then
    update public.profiles set gold = gold + floor(gift.cost * 100 * 0.7) where id = payee;
  end if;

  insert into public.room_gifts (room_id, sender_id, sender_name, gift_key, cost, recipient_id, recipient_name)
  values (p_room, uid, sender, gift.key, gift.cost, p_recipient, target);

  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (
    p_room, uid, sender, 'gift',
    sender || ' envió ' || gift.name || case when target is null then ' a la sala' else ' a ' || target end
  );
  return balance;
end;
$$;

grant execute on function public.send_gift_to(uuid, text, uuid) to authenticated;

-- Readers for the member card lists.
create or replace function public.profile_connections(p_profile uuid, p_kind text)
returns table (id uuid, display_name text, avatar_url text, level integer, is_following boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_url, p.level,
    exists (select 1 from public.profile_follows f where f.follower_id = auth.uid() and f.following_id = p.id)
  from public.profiles p
  where
    (p_kind = 'followers' and exists (
      select 1 from public.profile_follows f where f.following_id = p_profile and f.follower_id = p.id))
    or (p_kind = 'following' and exists (
      select 1 from public.profile_follows f where f.follower_id = p_profile and f.following_id = p.id))
    or (p_kind = 'friends' and exists (
      select 1 from public.profile_follows a
      join public.profile_follows b on b.follower_id = a.following_id and b.following_id = a.follower_id
      where a.follower_id = p_profile and a.following_id = p.id))
  order by p.level desc, p.display_name;
$$;

grant execute on function public.profile_connections(uuid, text) to authenticated;
