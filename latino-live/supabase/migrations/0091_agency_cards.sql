-- El nombre y el logo de la agencia de cada persona, para el perfil y la ficha
-- de usuario: una sola llamada para toda la lista de la sala.

create or replace function public.agency_cards(p_users uuid[])
returns table (user_id uuid, agency_name text, agency_photo_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, a.name, a.photo_url
    from public.profiles p
    join public.agencies a on a.id = p.agency_id
   where p.id = any(coalesce(p_users, '{}'::uuid[]));
$$;

revoke all on function public.agency_cards(uuid[]) from public, anon;
grant execute on function public.agency_cards(uuid[]) to authenticated;

-- La ficha del panel del dueno lleva tambien el logo, para reconocer la agencia.
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
    'agency_name', p.agency_name,
    'agency_photo_url', (select a.photo_url from public.agencies a where a.id = p.agency_id),
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
