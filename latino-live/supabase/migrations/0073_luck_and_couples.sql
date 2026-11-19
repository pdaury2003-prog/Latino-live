-- Room luck: a dice roll or a seat draw that the whole room sees in the chat.
--
-- It is a message of its own kind so it can be drawn differently from talk,
-- and it is written by the sender's own account (the table's rules already
-- say who may post). Nothing is paid and nothing is won: the result is a
-- number everyone can see, which is what makes a room laugh.

alter table public.room_messages drop constraint if exists room_messages_kind_check;
alter table public.room_messages add constraint room_messages_kind_check
  check (kind in ('welcome', 'system', 'user', 'announcement', 'gift', 'photo', 'luck'));

-- Couples (CP): one row per pair, always stored with the smaller id first so
-- two people can never create two rows for the same relationship.
create table if not exists public.couples (
  a uuid not null references auth.users (id) on delete cascade,
  b uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active')),
  requested_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  primary key (a, b),
  check (a <> b),
  check (a < b)
);

create index if not exists couples_a on public.couples (a) where status = 'active';
create index if not exists couples_b on public.couples (b) where status = 'active';
create index if not exists couples_pending on public.couples (requested_by) where status = 'pending';

alter table public.couples enable row level security;

-- Only the two people can read their own row; writes go through the functions.
drop policy if exists couples_read on public.couples;
create policy couples_read on public.couples
  for select to authenticated using (auth.uid() = a or auth.uid() = b);

grant select on public.couples to authenticated;

/** True when this person already has an active couple, or a pending request. */
create or replace function public.couple_busy(p_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.couples
     where (a = p_user or b = p_user)
  );
$$;

/** Asks another person to be their couple. One live link per person at a time. */
create or replace function public.request_couple(p_other uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  low uuid;
  high uuid;
begin
  if uid is null then raise exception 'Inicia sesion'; end if;
  if p_other is null or p_other = uid then raise exception 'Elige a otra persona'; end if;

  if public.couple_busy(uid) then
    raise exception 'Ya tienes una pareja o una solicitud pendiente';
  end if;
  if public.couple_busy(p_other) then
    raise exception 'Esa persona ya tiene pareja';
  end if;

  low := least(uid, p_other);
  high := greatest(uid, p_other);
  insert into public.couples (a, b, status, requested_by)
    values (low, high, 'pending', uid)
    on conflict (a, b) do update
      set status = 'pending', requested_by = uid, created_at = now(), answered_at = null;

  return 'pending';
end;
$$;

/** The other person says yes or no. Only they can answer, and only once. */
create or replace function public.answer_couple(p_other uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  low uuid;
  high uuid;
  row public.couples;
begin
  if uid is null then raise exception 'Inicia sesion'; end if;
  low := least(uid, p_other);
  high := greatest(uid, p_other);

  select * into row from public.couples where a = low and b = high for update;
  if row.a is null then raise exception 'Esa solicitud ya no existe'; end if;
  if row.requested_by = uid then raise exception 'La solicitud la responde la otra persona'; end if;
  if row.status <> 'pending' then raise exception 'Esa solicitud ya fue respondida'; end if;

  if p_accept then
    update public.couples
       set status = 'active', answered_at = now()
     where a = low and b = high;
    return 'active';
  end if;

  delete from public.couples where a = low and b = high;
  return 'rejected';
end;
$$;

/** Ends the couple, whichever of the two asks. */
create or replace function public.end_couple()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Inicia sesion'; end if;
  delete from public.couples where a = uid or b = uid;
  return true;
end;
$$;

/**
 * The person's couple, as the profile needs it: who it is, whether it is still
 * a request, and who asked. One row, because a person can only have one.
 */
create or replace function public.my_couple()
returns table (
  partner_id uuid,
  partner_name text,
  partner_avatar text,
  status text,
  incoming boolean
)
language sql
security definer
set search_path = public
stable
as $$
  with me as (select auth.uid() as uid)
  select
    p.id,
    p.display_name,
    p.avatar_url,
    c.status,
    c.requested_by <> me.uid
  from public.couples c
  join me on me.uid is not null and (me.uid = c.a or me.uid = c.b)
  join public.profiles p on p.id = case when c.a = me.uid then c.b else c.a end
  limit 1;
$$;

grant execute on function public.request_couple(uuid) to authenticated;
grant execute on function public.answer_couple(uuid, boolean) to authenticated;
grant execute on function public.end_couple() to authenticated;
grant execute on function public.my_couple() to authenticated;
grant execute on function public.couple_busy(uuid) to authenticated;
