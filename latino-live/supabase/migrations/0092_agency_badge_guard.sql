-- La insignia de Agencia es el interruptor del panel: si el dueno la quita,
-- esa persona deja de mandar en su agencia (la agencia y su gente siguen
-- existiendo, pero el panel pasa a solo lectura para ella). Antes el panel
-- seguia abierto aunque la insignia se hubiera retirado.

/** La agencia que esta persona manda ahora mismo: solo con insignia vigente. */
create or replace function public.agency_i_manage()
returns public.agencies
language sql
stable
security definer
set search_path = public
as $$
  select a.*
    from public.agencies a
    join public.profiles p on p.id = a.owner_id
   where a.owner_id = (select auth.uid()) and p.badge = 'agency';
$$;

revoke all on function public.agency_i_manage() from public, anon;
grant execute on function public.agency_i_manage() to authenticated;

create or replace function public.agency_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  agency public.agencies;
  my_role text := null;
  people jsonb;
  month_total bigint := 0;
  member_total integer := 0;
begin
  if uid is null then raise exception 'Inicia sesion para ver tu agencia'; end if;

  select * into agency from public.agency_i_manage();
  if agency.id is not null then
    my_role := 'manager';
  else
    select a.* into agency
      from public.agencies a
      join public.profiles p on p.agency_id = a.id
     where p.id = uid;
    if agency.id is not null then my_role := 'member'; end if;
  end if;

  if agency.id is null then
    return jsonb_build_object(
      'role', case when exists (select 1 from public.profiles p where p.id = uid and p.badge = 'agency') then 'manager' else null end,
      'agency', null,
      'members', '[]'::jsonb,
      'totals', jsonb_build_object('members', 0, 'month_diamonds', 0)
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id,
           'display_name', t.display_name,
           'avatar_url', t.avatar_url,
           'level', t.level,
           'diamonds', t.diamonds,
           'is_manager', t.id = agency.owner_id,
           'month_diamonds', t.month,
           'meta_level', coalesce(mt.level, (select max(am.level) from public.agency_metas am)),
           'meta_target', coalesce(mt.target, (select max(am.target) from public.agency_metas am)),
           'since', t.created_at
         ) order by t.month desc, t.display_name), '[]'::jsonb)
    into people
    from (
      select p.id, p.display_name, p.avatar_url, p.level, p.diamonds, p.created_at,
             coalesce((select sum(g.cost) from public.room_gifts g
                        where g.recipient_id = p.id and g.created_at >= date_trunc('month', now())), 0)::bigint as month
        from public.profiles p
       where p.agency_id = agency.id
    ) t
    left join lateral (
      select am.level, am.target
        from public.agency_metas am
       where am.target >= t.month
       order by am.target
       limit 1
    ) mt on true;

  select count(*), coalesce(sum((member ->> 'month_diamonds')::bigint), 0)
    into member_total, month_total
    from jsonb_array_elements(people) as member;

  return jsonb_build_object(
    'role', my_role,
    'agency', jsonb_build_object('id', agency.id, 'name', agency.name, 'photo_url', agency.photo_url, 'owner_id', agency.owner_id),
    'members', people,
    'totals', jsonb_build_object('members', member_total, 'month_diamonds', month_total)
  );
end;
$$;

revoke all on function public.agency_dashboard() from public, anon;
grant execute on function public.agency_dashboard() to authenticated;

create or replace function public.agency_save(p_name text, p_photo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean text := nullif(btrim(coalesce(p_name, '')), '');
  photo text := nullif(btrim(coalesce(p_photo, '')), '');
  mine public.agencies;
  taken boolean := false;
begin
  if uid is null then raise exception 'Inicia sesion para guardar tu agencia'; end if;
  if not exists (select 1 from public.profiles p where p.id = uid and p.badge = 'agency') then
    raise exception 'Solo una agencia puede tener su propio panel';
  end if;
  if clean is null or char_length(clean) < 2 then raise exception 'Escribe el nombre de tu agencia'; end if;
  if char_length(clean) > 40 then raise exception 'El nombre de la agencia es demasiado largo'; end if;
  if photo is not null and char_length(photo) > 500 then raise exception 'Esa foto no se puede guardar'; end if;

  select * into mine from public.agencies a where a.owner_id = uid;
  select exists (
    select 1 from public.agencies a
     where lower(btrim(a.name)) = lower(clean) and (mine.id is null or a.id <> mine.id)
  ) into taken;
  if taken then raise exception 'Ya existe una agencia con ese nombre'; end if;

  if mine.id is null then
    insert into public.agencies (name, photo_url, owner_id)
    values (clean, photo, uid)
    returning * into mine;
  else
    update public.agencies set name = clean, photo_url = photo where id = mine.id;
  end if;

  update public.profiles set agency_id = mine.id, agency_name = clean where id = uid;
  update public.profiles set agency_name = clean where agency_id = mine.id;
  perform public.admin_log('agency_save', uid, clean, 'La agencia guardo su ficha');
  return jsonb_build_object('id', mine.id, 'name', clean, 'photo_url', photo);
end;
$$;

revoke all on function public.agency_save(text, text) from public, anon;
grant execute on function public.agency_save(text, text) to authenticated;

create or replace function public.agency_lookup(p_query text)
returns table (
  id uuid,
  display_name text,
  user_number integer,
  avatar_url text,
  level integer,
  agency_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean text := btrim(coalesce(p_query, ''));
  digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
begin
  if uid is null then raise exception 'Inicia sesion para buscar cuentas'; end if;
  if (select a.id from public.agency_i_manage() a) is null then
    raise exception 'Solo la agencia agrega a su gente';
  end if;
  if char_length(clean) < 2 then
    return;
  end if;
  return query
    select p.id, p.display_name, p.user_number, p.avatar_url, p.level, p.agency_name
      from public.profiles p
     where p.id <> uid
       and not exists (select 1 from public.agencies a where a.owner_id = p.id)
       and (p.display_name ilike '%' || clean || '%'
            or (digits <> '' and p.user_number::text like '%' || digits || '%'))
     order by (p.agency_name is null) desc, p.level desc
     limit 6;
end;
$$;

revoke all on function public.agency_lookup(text) from public, anon;
grant execute on function public.agency_lookup(text) to authenticated;

create or replace function public.agency_add_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mine public.agencies;
  target public.profiles;
  total integer;
begin
  if uid is null then raise exception 'Inicia sesion para sumar gente'; end if;
  select * into mine from public.agency_i_manage();
  if mine.id is null then raise exception 'Solo la agencia suma a su gente'; end if;
  if p_user = uid then raise exception 'Tu ya estas en tu agencia'; end if;
  select * into target from public.profiles p where p.id = p_user;
  if target.id is null then raise exception 'Esa cuenta no existe'; end if;
  if target.agency_id = mine.id then raise exception 'Esa persona ya esta en tu agencia'; end if;
  if exists (select 1 from public.agencies a where a.owner_id = p_user) then
    raise exception 'Esa persona tiene su propia agencia';
  end if;
  select count(*) into total from public.profiles p where p.agency_id = mine.id;
  if total >= 50 then raise exception 'La agencia ya tiene 50 personas'; end if;

  update public.profiles set agency_id = mine.id, agency_name = mine.name where id = p_user;
  perform public.admin_log('agency_add', p_user, target.display_name, 'Entro a la agencia ' || mine.name);
end;
$$;

revoke all on function public.agency_add_member(uuid) from public, anon;
grant execute on function public.agency_add_member(uuid) to authenticated;

create or replace function public.agency_remove_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mine public.agencies;
  target public.profiles;
begin
  if uid is null then raise exception 'Inicia sesion para cambiar tu agencia'; end if;
  select * into mine from public.agency_i_manage();
  if mine.id is null then raise exception 'Solo la agencia cambia a su gente'; end if;
  if p_user = uid then raise exception 'Tu sigues siendo la agencia'; end if;
  select * into target from public.profiles p where p.id = p_user;
  if target.id is null or target.agency_id is distinct from mine.id then
    raise exception 'Esa persona no esta en tu agencia';
  end if;
  update public.profiles set agency_id = null, agency_name = null where id = p_user;
  perform public.admin_log('agency_remove', p_user, target.display_name, 'Salio de la agencia ' || mine.name);
end;
$$;

revoke all on function public.agency_remove_member(uuid) from public, anon;
grant execute on function public.agency_remove_member(uuid) to authenticated;
