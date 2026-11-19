-- The code of a private room belongs to its host alone: keeping it in
-- public.rooms would hand it to anyone able to read the room.

create table if not exists public.room_join_codes (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now()
);

alter table public.room_join_codes enable row level security;

drop policy if exists room_join_codes_host_read on public.room_join_codes;
create policy room_join_codes_host_read on public.room_join_codes for select to authenticated
  using (
    exists (select 1 from public.rooms r where r.id = room_id and r.host_id = auth.uid())
  );

-- Carry over any code written by the previous version, then stop exposing it.
insert into public.room_join_codes (room_id, code)
select id, join_code from public.rooms
where join_code is not null and is_private
on conflict (room_id) do nothing;

update public.rooms set join_code = null where join_code is not null;

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
  code text;
begin
  if uid is null then raise exception 'Inicia sesión'; end if;
  select host_id into host from public.rooms where id = p_room;
  if host is null then raise exception 'La sala ya no existe'; end if;
  if host <> uid then raise exception 'Solo el dueño de la sala puede cambiarlo'; end if;

  if p_private then
    select code into current_code from public.room_join_codes where room_id = p_room;
    code := coalesce(nullif(trim(p_code), ''), current_code, upper(substr(md5(random()::text), 1, 6)));
    insert into public.room_join_codes (room_id, code) values (p_room, code)
    on conflict (room_id) do update set code = excluded.code;
    update public.rooms set is_private = true where id = p_room;
    return code;
  end if;

  delete from public.room_join_codes where room_id = p_room;
  update public.rooms set is_private = false where id = p_room;
  return null;
end;
$$;

create or replace function public.room_code_matches(p_room uuid, p_code text)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select upper(trim(c.code)) = upper(trim(p_code))
       from public.room_join_codes c
       join public.rooms r on r.id = c.room_id
      where c.room_id = p_room and r.is_private),
    false);
$$;

grant execute on function public.set_room_private(uuid, boolean, text) to authenticated;
grant execute on function public.room_code_matches(uuid, text) to anon, authenticated;
