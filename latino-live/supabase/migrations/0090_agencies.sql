-- Agencias: una agencia tiene nombre, logo y una persona que la representa.
-- Solo el dueno da la insignia de Agencia; a partir de ahi esa persona entra a
-- su panel, pone el nombre y la foto, suma gente y sigue la meta de cada
-- miembro. El nombre de la agencia sigue copiandose en profiles.agency_name
-- para que el perfil y el panel del dueno lo ensenen sin cambios.

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 40),
  photo_url text,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists agencies_name_key on public.agencies (lower(btrim(name)));
create unique index if not exists agencies_owner_key on public.agencies (owner_id);

alter table public.profiles add column if not exists agency_id uuid references public.agencies (id) on delete set null;
create index if not exists profiles_agency on public.profiles (agency_id);

alter table public.agencies enable row level security;

drop policy if exists "agencies are readable" on public.agencies;
create policy "agencies are readable" on public.agencies
  for select to authenticated using (true);

drop policy if exists "the owner writes their agency" on public.agencies;
create policy "the owner writes their agency" on public.agencies
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select on public.agencies to authenticated;
grant update (name, photo_url) on public.agencies to authenticated;

-- Las agencias que ya existian como nombre libre en los perfiles.
do $$
declare
  grp record;
  keeper uuid;
  made uuid;
begin
  for grp in
    select btrim(p.agency_name) as name
      from public.profiles p
     where p.agency_name is not null and btrim(p.agency_name) <> ''
     group by lower(btrim(p.agency_name)), btrim(p.agency_name)
  loop
    if exists (select 1 from public.agencies a where lower(btrim(a.name)) = lower(grp.name)) then
      continue;
    end if;
    select p.id into keeper
      from public.profiles p
     where lower(btrim(p.agency_name)) = lower(grp.name)
       and not exists (select 1 from public.agencies a where a.owner_id = p.id)
     order by (p.badge = 'agency') desc, p.created_at
     limit 1;
    if keeper is null then
      continue;
    end if;
    insert into public.agencies (name, owner_id) values (grp.name, keeper) returning id into made;
    update public.profiles p set agency_id = made
     where p.agency_id is null and lower(btrim(p.agency_name)) = lower(grp.name);
  end loop;
end;
$$;

-- El logo de la agencia: publico para leerse, escrito solo por su dueno.
insert into storage.buckets (id, name, public)
values ('agency-media', 'agency-media', true)
on conflict (id) do nothing;

drop policy if exists "agency media is public" on storage.objects;
create policy "agency media is public" on storage.objects
  for select using (bucket_id = 'agency-media');

drop policy if exists "an agency writes its own logo" on storage.objects;
create policy "an agency writes its own logo" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'agency-media'
    and exists (
      select 1 from public.agencies a
       where a.owner_id = auth.uid() and (storage.foldername(name))[1] = a.id::text
    )
  );

drop policy if exists "an agency updates its own logo" on storage.objects;
create policy "an agency updates its own logo" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'agency-media'
    and exists (
      select 1 from public.agencies a
       where a.owner_id = auth.uid() and (storage.foldername(name))[1] = a.id::text
    )
  );

drop policy if exists "an agency removes its own logo" on storage.objects;
create policy "an agency removes its own logo" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'agency-media'
    and exists (
      select 1 from public.agencies a
       where a.owner_id = auth.uid() and (storage.foldername(name))[1] = a.id::text
    )
  );

-- Las diez metas de la casa, en diamantes recibidos dentro del mes.
create table if not exists public.agency_metas (
  level integer primary key,
  target integer not null check (target > 0)
);

insert into public.agency_metas (level, target) values
  (1, 500), (2, 1000), (3, 2500), (4, 5000), (5, 10000),
  (6, 20000), (7, 50000), (8, 100000), (9, 250000), (10, 500000)
on conflict (level) do update set target = excluded.target;

alter table public.agency_metas enable row level security;
drop policy if exists "metas are readable" on public.agency_metas;
create policy "metas are readable" on public.agency_metas
  for select to authenticated using (true);
grant select on public.agency_metas to authenticated;

/** El panel de la agencia: su ficha, su gente y la meta del mes de cada uno. */
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

  select * into agency from public.agencies a where a.owner_id = uid;
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

/**
 * La agencia escribe su ficha: nombre y logo. La primera vez se crea, y solo
 * puede hacerlo quien lleva la insignia de Agencia que da el dueno.
 */
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
    if not exists (select 1 from public.profiles p where p.id = uid and p.badge = 'agency') then
      raise exception 'Solo una agencia puede tener su propio panel';
    end if;
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

/** Busca cuentas por nombre o numero de cuenta para sumarlas a la agencia. */
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
  if not exists (select 1 from public.agencies a where a.owner_id = uid) then
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

/** La agencia suma a una persona; su nombre queda copiado en su perfil. */
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
  select * into mine from public.agencies a where a.owner_id = uid;
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

/** La agencia saca a alguien, o la persona se sale por su cuenta. */
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
  select * into mine from public.agencies a where a.owner_id = uid;
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

create or replace function public.agency_leave()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mine public.agencies;
begin
  if uid is null then raise exception 'Inicia sesion para salir de tu agencia'; end if;
  select * into mine from public.agencies a where a.owner_id = uid;
  if mine.id is not null then raise exception 'Tu eres la agencia: no puedes salir de ella';
  end if;
  update public.profiles set agency_id = null, agency_name = null where id = uid;
end;
$$;

revoke all on function public.agency_leave() from public, anon;
grant execute on function public.agency_leave() to authenticated;

/**
 * El dueno sigue escribiendo la agencia desde Personas. Ahora mueve a la
 * persona dentro de la agencia de verdad, para que su logo y su panel sean los
 * mismos que ve el resto de la agencia.
 */
create or replace function public.admin_set_agency(p_user uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean text := nullif(btrim(coalesce(p_name, '')), '');
  target_name text;
  found public.agencies;
  owned public.agencies;
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

  if clean is null then
    update public.profiles set agency_name = null, agency_id = null where id = p_user;
  else
    select * into found from public.agencies a where lower(btrim(a.name)) = lower(clean);
    if found.id is null then
      select * into owned from public.agencies a where a.owner_id = p_user;
      if owned.id is not null then
        update public.agencies set name = clean where id = owned.id;
        update public.profiles set agency_name = clean where agency_id = owned.id;
        found := owned;
      else
        insert into public.agencies (name, owner_id) values (clean, p_user) returning * into found;
      end if;
    end if;
    update public.profiles set agency_id = found.id, agency_name = found.name where id = p_user;
  end if;

  perform public.admin_log(
    'agency_set', p_user, target_name,
    case when clean is null then 'Sin agencia' else 'Agencia ' || clean end
  );
end;
$$;
