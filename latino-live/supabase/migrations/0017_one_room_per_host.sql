-- A person hosts one room at a time. A room can be closed by its host, and a
-- closed room leaves the billboard but keeps its history.

alter table public.rooms add column if not exists closed_at timestamptz;

-- Existing hosts keep their newest room; older ones are closed, not deleted.
update public.rooms r
   set closed_at = now()
 where r.host_id is not null
   and r.closed_at is null
   and exists (
     select 1 from public.rooms newer
      where newer.host_id = r.host_id
        and newer.closed_at is null
        and (newer.created_at, newer.id) > (r.created_at, r.id)
   );

create unique index if not exists rooms_one_open_per_host
  on public.rooms (host_id)
  where host_id is not null and closed_at is null;

/** Opens the person's room: the same one every time while it stays open. */
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
  existing uuid;
begin
  if uid is null then raise exception 'Inicia sesión para abrir una sala'; end if;
  -- Serialise two quick taps from the same account.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 7));
  select r.id into existing
    from public.rooms r
   where r.host_id = uid and r.closed_at is null
   order by r.created_at desc
   limit 1;
  if existing is not null then
    return existing;
  end if;
  clean := left(coalesce(nullif(btrim(p_title), ''), 'Mi sala'), 60);
  insert into public.rooms (slug, title, host_id, host_name, country, cover, max_seats)
  values (
    lower(regexp_replace(clean, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6),
    clean,
    uid,
    public.my_display_name(),
    case when p_country in ('US', 'ES', 'MX', 'AR', 'CO') then p_country else 'US' end,
    case when p_cover in ('palace', 'pool', 'terrace') then p_cover else 'palace' end,
    10
  )
  returning id into new_id;
  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (new_id, uid, public.my_display_name(), 'welcome', 'Bienvenido a la sala. Respeta a los demás. Nada de contenido para adultos, apuestas ni política.');
  return new_id;
end;
$$;
grant execute on function public.open_room(text, text, text) to authenticated;

/** Closes the host's room for everyone; the host can then open a fresh one. */
create or replace function public.close_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner uuid;
begin
  if uid is null then raise exception 'Inicia sesión'; end if;
  select host_id into owner from public.rooms where id = p_room for update;
  if owner is null or owner <> uid then raise exception 'Solo el anfitrión puede cerrar esta sala'; end if;
  update public.rooms set closed_at = now() where id = p_room;
  delete from public.room_seats where room_id = p_room;
  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (p_room, uid, public.my_display_name(), 'system', 'El anfitrión cerró esta sala.');
end;
$$;
grant execute on function public.close_room(uuid) to authenticated;
