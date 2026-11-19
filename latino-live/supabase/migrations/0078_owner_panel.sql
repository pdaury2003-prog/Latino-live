-- Panel Owner: staff roles, permanent suspensions and an audit trail.
--
-- Access is a real database role, never a second password. The panel asks the
-- signed-in person to confirm the password of their own account, and the server
-- checks the role again before every read and every action.

create table if not exists public.app_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'moderator',
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_roles add column if not exists granted_by uuid references auth.users (id) on delete set null;
alter table public.app_roles add column if not exists updated_at timestamptz not null default now();
alter table public.app_roles drop constraint if exists app_roles_role_check;
alter table public.app_roles add constraint app_roles_role_check check (role in ('owner', 'admin', 'moderator'));

alter table public.app_roles enable row level security;

-- A person reads only their own row. The staff functions run as the definer,
-- so this policy can never recurse into itself.
drop policy if exists app_roles_self_read on public.app_roles;
create policy app_roles_self_read on public.app_roles
  for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.staff_rank(p_role text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_role when 'owner' then 3 when 'admin' then 2 when 'moderator' then 1 else 0 end;
$$;

create or replace function public.my_staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.role from public.app_roles r where r.user_id = (select auth.uid());
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_roles r where r.user_id = (select auth.uid()));
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_roles r
     where r.user_id = (select auth.uid()) and r.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_roles r
     where r.user_id = (select auth.uid()) and r.role = 'owner'
  );
$$;

revoke all on function public.staff_rank(text) from public;
revoke all on function public.my_staff_role() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_owner() from public;
grant execute on function public.staff_rank(text) to authenticated;
grant execute on function public.my_staff_role() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_owner() to authenticated;

-- A suspended account keeps its profile and history, but cannot take part.
create table if not exists public.account_bans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 300),
  banned_by uuid references auth.users (id) on delete set null,
  banned_at timestamptz not null default now(),
  until timestamptz
);

alter table public.account_bans enable row level security;

drop policy if exists account_bans_own on public.account_bans;
create policy account_bans_own on public.account_bans
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists account_bans_staff on public.account_bans;
create policy account_bans_staff on public.account_bans
  for select to authenticated
  using ((select public.is_staff()));

create or replace function public.is_account_banned(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.account_bans b
     where b.user_id = p_user and (b.until is null or b.until > now())
  );
$$;

create or replace function public.my_account_ban()
returns table (reason text, banned_at timestamptz, until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.reason, b.banned_at, b.until
    from public.account_bans b
   where b.user_id = (select auth.uid()) and (b.until is null or b.until > now());
$$;

revoke all on function public.is_account_banned(uuid) from public;
revoke all on function public.my_account_ban() from public;
grant execute on function public.is_account_banned(uuid) to authenticated;
grant execute on function public.my_account_ban() to authenticated;

-- One place for every write that must stop for a suspended person.
create or replace function public.assert_account_active()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  blocked text;
begin
  select b.reason into blocked
    from public.account_bans b
   where b.user_id = (select auth.uid()) and (b.until is null or b.until > now())
   limit 1;
  if blocked is not null then
    raise exception 'Tu cuenta esta suspendida: %', blocked;
  end if;
end;
$$;

revoke all on function public.assert_account_active() from public;
grant execute on function public.assert_account_active() to authenticated;

-- Every staff action leaves a line nobody can edit from the app.
create table if not exists public.admin_audit (
  id bigint generated by default as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  actor_name text not null default 'Equipo',
  action text not null,
  target_id uuid references auth.users (id) on delete set null,
  target_name text,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_created_idx on public.admin_audit (created_at desc, id desc);

alter table public.admin_audit enable row level security;

drop policy if exists admin_audit_staff_read on public.admin_audit;
create policy admin_audit_staff_read on public.admin_audit
  for select to authenticated
  using ((select public.is_staff()));

-- Only the functions below write the audit, and they always sign it themselves.
revoke insert, update, delete on public.admin_audit from anon, authenticated;

create or replace function public.admin_log(
  p_action text,
  p_target uuid,
  p_target_name text,
  p_detail text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_audit (actor_id, actor_name, action, target_id, target_name, detail)
  values (
    (select auth.uid()),
    coalesce((select p.display_name from public.profiles p where p.id = (select auth.uid())), 'Equipo'),
    p_action,
    p_target,
    p_target_name,
    p_detail
  );
$$;

revoke all on function public.admin_log(text, uuid, text, text) from public, anon, authenticated;

-- New writes respect a suspension even when a screen forgets to ask.
create or replace function public.assert_not_banned(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  blocked_until timestamptz;
begin
  perform public.assert_account_active();
  select b.until into blocked_until
    from public.room_bans b
   where b.room_id = p_room and b.user_id = auth.uid() and b.until > now();
  if blocked_until is not null then
    raise exception 'El anfitrion te expulso de esta sala. Podras volver en %',
      greatest(1, ceil(extract(epoch from (blocked_until - now())) / 3600))::text || ' h';
  end if;
end;
$$;

create or replace function public.post_room_message(p_room uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean text := left(btrim(coalesce(p_body, '')), 400);
begin
  if uid is null then raise exception 'Inicia sesion para escribir'; end if;
  if clean = '' then return; end if;
  if not exists (select 1 from public.rooms where id = p_room) then raise exception 'La sala ya no existe'; end if;
  perform public.assert_not_banned(p_room);
  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (p_room, uid, public.my_display_name(), 'user', clean);
end;
$$;

create or replace function public.send_room_gift(p_room uuid, p_gift text)
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
  host uuid;
begin
  if uid is null then raise exception 'Inicia sesion para enviar un regalo'; end if;
  perform public.assert_account_active();
  select * into gift from public.gift_catalog where key = p_gift;
  if gift.key is null then raise exception 'Ese regalo no existe'; end if;
  if not exists (select 1 from public.rooms where id = p_room) then raise exception 'La sala ya no existe'; end if;
  update public.profiles set diamonds = diamonds - gift.cost
  where id = uid and diamonds >= gift.cost
  returning diamonds, display_name into balance, sender;
  if balance is null then raise exception 'No tienes suficientes diamantes'; end if;
  select host_id into host from public.rooms where id = p_room;
  if host is not null and host <> uid then
    update public.profiles set gold = gold + floor(gift.cost * 100 * 0.7) where id = host;
  end if;
  insert into public.room_gifts (room_id, sender_id, sender_name, gift_key, cost)
  values (p_room, uid, sender, gift.key, gift.cost);
  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (p_room, uid, sender, 'gift', sender || ' envio ' || gift.name || ' a la sala');
  return balance;
end;
$$;

grant execute on function public.post_room_message(uuid, text) to authenticated;
grant execute on function public.send_room_gift(uuid, text) to authenticated;

drop policy if exists no_suspended_room_messages on public.room_messages;
create policy no_suspended_room_messages on public.room_messages
  as restrictive for insert to authenticated
  with check (not public.is_account_banned());

drop policy if exists no_suspended_room_seats on public.room_seats;
create policy no_suspended_room_seats on public.room_seats
  as restrictive for insert to authenticated
  with check (not public.is_account_banned());

drop policy if exists no_suspended_room_seats_update on public.room_seats;
create policy no_suspended_room_seats_update on public.room_seats
  as restrictive for update to authenticated
  using (not public.is_account_banned());

drop policy if exists no_suspended_direct on public.direct_messages;
create policy no_suspended_direct on public.direct_messages
  as restrictive for insert to authenticated
  with check (not public.is_account_banned());

drop policy if exists no_suspended_moments on public.moments;
create policy no_suspended_moments on public.moments
  as restrictive for insert to authenticated
  with check (not public.is_account_banned());

drop policy if exists no_suspended_moment_comments on public.moment_comments;
create policy no_suspended_moment_comments on public.moment_comments
  as restrictive for insert to authenticated
  with check (not public.is_account_banned());

drop policy if exists no_suspended_moment_likes on public.moment_likes;
create policy no_suspended_moment_likes on public.moment_likes
  as restrictive for insert to authenticated
  with check (not public.is_account_banned());

drop policy if exists no_suspended_follows on public.profile_follows;
create policy no_suspended_follows on public.profile_follows
  as restrictive for insert to authenticated
  with check (not public.is_account_banned());

-- Follow, comments and visits are functions, so they ask directly.
create or replace function public.follow_user(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  now_following boolean;
begin
  if uid is null then raise exception 'Inicia sesion'; end if;
  perform public.assert_account_active();
  if p_user = uid then raise exception 'No puedes seguirte a ti mismo'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'Ese perfil no existe'; end if;
  if exists (select 1 from public.profile_follows where follower_id = uid and following_id = p_user) then
    delete from public.profile_follows where follower_id = uid and following_id = p_user;
    now_following := false;
  else
    insert into public.profile_follows (follower_id, following_id) values (uid, p_user);
    now_following := true;
  end if;
  return now_following;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Reads for the panel
-- ---------------------------------------------------------------------------------------------

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_staff() then raise exception 'No tienes acceso al panel'; end if;

  select jsonb_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_new_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'staff_total', (select count(*) from public.app_roles),
    'banned_total', (select count(*) from public.account_bans where until is null or until > now()),
    'rooms_open', (select count(*) from public.rooms where closed_at is null),
    'rooms_private', (select count(*) from public.rooms where closed_at is null and is_private),
    'seated_now', (select count(distinct user_id) from public.room_seats),
    'messages_24h', (select count(*) from public.room_messages where created_at > now() - interval '24 hours'),
    'gifts_24h', (select count(*) from public.room_gifts where created_at > now() - interval '24 hours'),
    'diamonds_24h', (select coalesce(sum(cost), 0) from public.room_gifts where created_at > now() - interval '24 hours'),
    'domino_playing', (select count(*) from public.domino_tables where status = 'playing'),
    'signups', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'count', total) order by day), '[]'::jsonb)
        from (
          select to_char(d.day, 'YYYY-MM-DD') as day,
                 (select count(*) from public.profiles p where p.created_at::date = d.day) as total
            from generate_series(current_date - interval '6 days', current_date, interval '1 day') as d(day)
        ) s
    ),
    'top_rooms', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'host', host_name, 'gifts', gifts) order by gifts desc), '[]'::jsonb)
        from (
          select r.id, r.title, r.host_name, sum(g.cost)::bigint as gifts
            from public.room_gifts g join public.rooms r on r.id = g.room_id
           where g.created_at > now() - interval '24 hours'
           group by r.id, r.title, r.host_name
           order by gifts desc
           limit 5
        ) t
    ),
    'latest_audit', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'actor_name', a.actor_name, 'action', a.action,
        'target_name', a.target_name, 'detail', a.detail, 'created_at', a.created_at
      ) order by a.created_at desc), '[]'::jsonb)
        from (select * from public.admin_audit order by created_at desc limit 6) a
    )
  ) into result;
  return result;
end;
$$;

create or replace function public.admin_people(p_query text default null, p_limit integer default 40)
returns table (
  id uuid,
  display_name text,
  user_number integer,
  avatar_url text,
  level integer,
  diamonds integer,
  gold integer,
  role text,
  banned boolean,
  ban_reason text,
  ban_until timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  clean text := btrim(coalesce(p_query, ''));
  cap integer := greatest(1, least(100, coalesce(p_limit, 40)));
begin
  if not public.is_staff() then raise exception 'No tienes acceso al panel'; end if;
  return query
    select p.id, p.display_name, p.user_number, p.avatar_url, p.level, p.diamonds, p.gold,
           r.role,
           (b.user_id is not null and (b.until is null or b.until > now())) as banned,
           case when b.user_id is not null and (b.until is null or b.until > now()) then b.reason else null end,
           case when b.user_id is not null and (b.until is null or b.until > now()) then b.until else null end,
           p.created_at
      from public.profiles p
      left join public.app_roles r on r.user_id = p.id
      left join public.account_bans b on b.user_id = p.id
     where clean = ''
        or p.display_name ilike '%' || clean || '%'
        or (regexp_replace(clean, '\D', '', 'g') <> ''
            and p.user_number::text like '%' || regexp_replace(clean, '\D', '', 'g') || '%')
        or p.id::text = clean
     order by (r.role is not null) desc, p.created_at desc
     limit cap;
end;
$$;

create or replace function public.admin_person(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_staff() then raise exception 'No tienes acceso al panel'; end if;
  select jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'user_number', p.user_number,
    'avatar_url', p.avatar_url,
    'level', p.level,
    'diamonds', p.diamonds,
    'gold', p.gold,
    'created_at', p.created_at,
    'role', r.role,
    'banned', (b.user_id is not null and (b.until is null or b.until > now())),
    'ban_reason', case when b.user_id is not null and (b.until is null or b.until > now()) then b.reason else null end,
    'ban_until', case when b.user_id is not null and (b.until is null or b.until > now()) then b.until else null end,
    'messages_30d', (select count(*) from public.room_messages m where m.user_id = p.id and m.created_at > now() - interval '30 days'),
    'gifts_30d', (select coalesce(sum(g.cost), 0) from public.room_gifts g where g.sender_id = p.id and g.created_at > now() - interval '30 days'),
    'rooms_hosted', (select count(*) from public.rooms ro where ro.host_id = p.id and ro.closed_at is null),
    'followers', (select count(*) from public.profile_follows f where f.following_id = p.id),
    'following', (select count(*) from public.profile_follows f where f.follower_id = p.id),
    'domino_games', (select count(*) from public.domino_players d where d.user_id = p.id)
  ) into result
  from public.profiles p
  left join public.app_roles r on r.user_id = p.id
  left join public.account_bans b on b.user_id = p.id
  where p.id = p_user;
  return result;
end;
$$;

create or replace function public.admin_audit_log(p_limit integer default 60)
returns table (
  id bigint,
  actor_id uuid,
  actor_name text,
  action text,
  target_id uuid,
  target_name text,
  detail text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then raise exception 'No tienes acceso al panel'; end if;
  return query
    select a.id, a.actor_id, a.actor_name, a.action, a.target_id, a.target_name, a.detail, a.created_at
      from public.admin_audit a
     order by a.created_at desc, a.id desc
     limit greatest(1, least(200, coalesce(p_limit, 60)));
end;
$$;

create or replace function public.admin_rooms()
returns table (
  id uuid,
  title text,
  host_id uuid,
  host_name text,
  room_mode text,
  is_private boolean,
  max_seats integer,
  occupied integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then raise exception 'No tienes acceso al panel'; end if;
  return query
    select r.id, r.title, r.host_id, r.host_name, r.room_mode, r.is_private, r.max_seats,
           (select count(*)::integer from public.room_seats s where s.room_id = r.id),
           r.created_at
      from public.rooms r
     where r.closed_at is null
     order by (select count(*) from public.room_seats s where s.room_id = r.id) desc, r.created_at desc
     limit 60;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------------------------------

create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  actor_role text;
  actor_rank integer;
  target_role text;
  clean text := nullif(btrim(coalesce(p_role, '')), '');
  target_name text;
begin
  if uid is null then raise exception 'Inicia sesion'; end if;
  actor_role := public.my_staff_role();
  actor_rank := public.staff_rank(actor_role);
  if actor_rank < 3 then raise exception 'Solo el dueno cambia los roles del equipo'; end if;
  if p_user = uid then raise exception 'No puedes cambiar tu propio rol'; end if;

  select r.role into target_role from public.app_roles r where r.user_id = p_user;
  if target_role = 'owner' then raise exception 'El dueno no se puede cambiar'; end if;
  if clean is not null and clean not in ('admin', 'moderator') then raise exception 'Ese rol no existe'; end if;
  select display_name into target_name from public.profiles where id = p_user;
  if target_name is null then raise exception 'Esa cuenta no existe'; end if;

  if clean is null then
    delete from public.app_roles where user_id = p_user;
    perform public.admin_log('role_revoke', p_user, target_name, 'Sin rol de equipo');
  else
    insert into public.app_roles (user_id, role, granted_by)
    values (p_user, clean, uid)
    on conflict (user_id) do update
      set role = excluded.role, granted_by = excluded.granted_by, updated_at = now();
    perform public.admin_log('role_grant', p_user, target_name, case clean when 'admin' then 'Administrador' else 'Moderador' end);
  end if;
end;
$$;

create or replace function public.admin_ban(p_user uuid, p_reason text, p_days integer default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  actor_role text;
  actor_rank integer;
  target_role text;
  target_rank integer;
  target_name text;
  clean text := btrim(coalesce(p_reason, ''));
  until_at timestamptz;
begin
  if uid is null then raise exception 'Inicia sesion'; end if;
  actor_role := public.my_staff_role();
  actor_rank := public.staff_rank(actor_role);
  if actor_rank < 1 then raise exception 'No tienes acceso al panel'; end if;
  if p_user = uid then raise exception 'No puedes suspender tu propia cuenta'; end if;
  if char_length(clean) < 3 then raise exception 'Escribe el motivo de la suspension'; end if;

  select r.role into target_role from public.app_roles r where r.user_id = p_user;
  target_rank := public.staff_rank(target_role);
  if target_rank >= 3 then raise exception 'El dueno no se puede suspender'; end if;
  if actor_rank < 3 and target_rank >= actor_rank then
    raise exception 'No puedes suspender a alguien del mismo nivel o superior';
  end if;

  select display_name into target_name from public.profiles where id = p_user;
  if target_name is null then raise exception 'Esa cuenta no existe'; end if;
  if p_days is not null and p_days > 0 then
    until_at := now() + make_interval(days => least(p_days, 3650));
  end if;

  insert into public.account_bans (user_id, reason, banned_by, banned_at, until)
  values (p_user, left(clean, 300), uid, now(), until_at)
  on conflict (user_id) do update
    set reason = excluded.reason, banned_by = excluded.banned_by, banned_at = now(), until = excluded.until;

  -- The sign-in itself stops, and every screen closes for this person.
  update auth.users
     set banned_until = coalesce(until_at, '2999-12-31 00:00:00+00'::timestamptz)
   where id = p_user;

  delete from public.room_seats where user_id = p_user;
  if until_at is null then
    update public.rooms set closed_at = now() where host_id = p_user and closed_at is null;
  end if;

  update public.domino_tables
     set status = 'finished', reason = 'Un jugador fue suspendido', updated_at = now()
   where status = 'playing'
     and id in (select table_id from public.domino_players where user_id = p_user);
  delete from public.domino_players where user_id = p_user;

  perform public.admin_log(
    'account_ban', p_user, target_name,
    left(clean, 300) || case when until_at is null then ' (permanente)' else ' (' || p_days || ' dias)' end
  );
end;
$$;

create or replace function public.admin_unban(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target_name text;
begin
  if uid is null then raise exception 'Inicia sesion'; end if;
  if public.staff_rank(public.my_staff_role()) < 1 then raise exception 'No tienes acceso al panel'; end if;
  select display_name into target_name from public.profiles where id = p_user;
  delete from public.account_bans where user_id = p_user;
  update auth.users set banned_until = null where id = p_user;
  perform public.admin_log('account_unban', p_user, coalesce(target_name, p_user::text), null);
end;
$$;

create or replace function public.admin_close_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  title text;
  host uuid;
begin
  if public.staff_rank(public.my_staff_role()) < 2 then raise exception 'Solo el dueno o un administrador cierran salas'; end if;
  select r.title, r.host_id into title, host from public.rooms r where r.id = p_room and r.closed_at is null;
  if title is null then raise exception 'Esa sala ya esta cerrada'; end if;
  update public.rooms set closed_at = now() where id = p_room;
  delete from public.room_seats where room_id = p_room;
  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (p_room, auth.uid(), public.my_display_name(), 'system', 'La moderacion cerro esta sala.');
  perform public.admin_log('room_close', host, coalesce(title, p_room::text), 'Sala cerrada por moderacion');
end;
$$;

revoke all on function public.admin_overview() from public, anon;
revoke all on function public.admin_people(text, integer) from public, anon;
revoke all on function public.admin_person(uuid) from public, anon;
revoke all on function public.admin_audit_log(integer) from public, anon;
revoke all on function public.admin_rooms() from public, anon;
revoke all on function public.admin_set_role(uuid, text) from public, anon;
revoke all on function public.admin_ban(uuid, text, integer) from public, anon;
revoke all on function public.admin_unban(uuid) from public, anon;
revoke all on function public.admin_close_room(uuid) from public, anon;

grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_people(text, integer) to authenticated;
grant execute on function public.admin_person(uuid) to authenticated;
grant execute on function public.admin_audit_log(integer) to authenticated;
grant execute on function public.admin_rooms() to authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
grant execute on function public.admin_ban(uuid, text, integer) to authenticated;
grant execute on function public.admin_unban(uuid) to authenticated;
grant execute on function public.admin_close_room(uuid) to authenticated;
