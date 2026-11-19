-- La ficha y la lista del panel muestran también la insignia vigente.

drop function if exists public.admin_people(text, integer);

create function public.admin_people(p_query text default null, p_limit integer default 40)
returns table (
  id uuid,
  display_name text,
  user_number integer,
  avatar_url text,
  level integer,
  diamonds integer,
  gold integer,
  role text,
  badge text,
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
           (select pb.badge from public.profile_badges(array[p.id]) pb),
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

revoke all on function public.admin_people(text, integer) from public, anon;
grant execute on function public.admin_people(text, integer) to authenticated;

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
    'badge', (select pb.badge from public.profile_badges(array[p.id]) pb),
    'assigned_badge', p.badge,
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
