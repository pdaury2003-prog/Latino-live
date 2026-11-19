-- El nombre de la agencia que representa una persona con insignia de Agencia.
-- Se ve bajo su nombre en el perfil; solo el dueno lo escribe.

alter table public.profiles add column if not exists agency_name text;

alter table public.profiles drop constraint if exists profiles_agency_name_check;
alter table public.profiles add constraint profiles_agency_name_check
  check (agency_name is null or (char_length(btrim(agency_name)) between 2 and 40));

/** Solo el dueno escribe el nombre de la agencia; queda en la auditoria. */
create or replace function public.admin_set_agency(p_user uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean text := nullif(btrim(coalesce(p_name, '')), '');
  target_name text;
begin
  if public.staff_rank(public.my_staff_role()) < 3 then
    raise exception 'Solo el dueno cambia las agencias';
  end if;
  if p_user = auth.uid() then raise exception 'Tu propia insignia es la de dueno'; end if;
  if clean is not null and char_length(clean) < 2 then
    raise exception 'El nombre de la agencia es demasiado corto';
  end if;
  if clean is not null and char_length(clean) > 40 then
    raise exception 'El nombre de la agencia es demasiado largo';
  end if;
  select display_name into target_name from public.profiles where id = p_user;
  if target_name is null then raise exception 'Esa cuenta no existe'; end if;

  update public.profiles set agency_name = clean where id = p_user;
  perform public.admin_log(
    'agency_set', p_user, target_name,
    case when clean is null then 'Sin agencia' else 'Agencia ' || clean end
  );
end;
$$;

revoke all on function public.admin_set_agency(uuid, text) from public, anon;
grant execute on function public.admin_set_agency(uuid, text) to authenticated;

-- La ficha del panel muestra tambien la agencia que el dueno escribio.
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
