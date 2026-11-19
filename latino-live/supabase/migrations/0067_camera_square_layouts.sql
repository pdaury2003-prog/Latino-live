-- Three camera squares: rooms of four, six and ten places drawn as equal
-- chairs in two rows. The phone already draws them from the app; the server
-- only has to accept their names, both when a room is opened and when the
-- host changes the shape later.

create or replace function public.set_room_layout(p_room uuid, p_layout text, p_seats integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_capacity integer := greatest(4, least(20, coalesce(p_seats, 12)));
  occupied integer;
  clean text := nullif(btrim(coalesce(p_layout, '')), '');
begin
  if not public.room_is_host(p_room) then raise exception 'Solo el anfitrión puede cambiar el diseño'; end if;
  if clean is not null and clean not in (
    'square4', 'square6', 'square10',
    'classic', 'neon', 'stage', 'diamond', 'galaxy', 'circle', 'heart', 'amphitheater', 'teams'
  ) then
    raise exception 'Ese diseño no existe';
  end if;
  select count(*) into occupied from public.room_seats where room_id = p_room;
  if occupied > next_capacity then
    raise exception 'Hay % personas sentadas y este diseño tiene % lugares', occupied, next_capacity;
  end if;
  update public.rooms set layout = clean, max_seats = next_capacity where id = p_room;
end;
$$;

grant execute on function public.set_room_layout(uuid, text, integer) to authenticated;

create or replace function public.open_room(
  p_title text,
  p_cover text default 'palace',
  p_country text default 'US',
  p_layout text default null,
  p_seats integer default 10
)
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
  clean_layout text := nullif(btrim(coalesce(p_layout, '')), '');
  places integer;
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
  if clean_layout is not null and clean_layout not in (
    'square4', 'square6', 'square10',
    'classic', 'neon', 'stage', 'diamond', 'galaxy', 'circle', 'heart', 'amphitheater', 'teams'
  ) then
    clean_layout := null;
  end if;
  -- A design draws a fixed number of places; the grid keeps the usual ten.
  places := greatest(4, least(20, coalesce(p_seats, 10)));
  clean := left(coalesce(nullif(btrim(p_title), ''), 'Mi sala'), 60);
  insert into public.rooms (slug, title, host_id, host_name, country, cover, max_seats, layout)
  values (
    lower(regexp_replace(clean, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6),
    clean,
    uid,
    public.my_display_name(),
    case when p_country in ('US', 'ES', 'MX', 'AR', 'CO') then p_country else 'US' end,
    case when p_cover in ('palace', 'pool', 'terrace') then p_cover else 'palace' end,
    places,
    clean_layout
  )
  returning id into new_id;
  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (new_id, uid, public.my_display_name(), 'welcome', 'Bienvenido a la sala. Respeta a los demás. Nada de contenido para adultos, apuestas ni política.');
  return new_id;
end;
$$;

grant execute on function public.open_room(text, text, text, text, integer) to authenticated;
