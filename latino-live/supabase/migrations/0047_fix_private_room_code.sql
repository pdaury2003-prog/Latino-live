-- The stored code column shares its name with the function's variable, which
-- Postgres refuses to resolve. Keep each one in its own name.

create or replace function public.set_room_private(p_room uuid, p_private boolean, p_code text default null)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  host uuid;
  current_code text;
  new_code text;
begin
  if uid is null then raise exception 'Inicia sesión'; end if;
  select host_id into host from public.rooms where id = p_room;
  if host is null then raise exception 'La sala ya no existe'; end if;
  if host <> uid then raise exception 'Solo el dueño de la sala puede cambiarlo'; end if;

  if p_private then
    select c.code into current_code from public.room_join_codes c where c.room_id = p_room;
    new_code := coalesce(nullif(trim(p_code), ''), current_code, upper(substr(md5(random()::text), 1, 6)));
    insert into public.room_join_codes as c (room_id, code) values (p_room, new_code)
    on conflict (room_id) do update set code = excluded.code;
    update public.rooms set is_private = true where id = p_room;
    return new_code;
  end if;

  delete from public.room_join_codes where room_id = p_room;
  update public.rooms set is_private = false where id = p_room;
  return null;
end;
$$;
