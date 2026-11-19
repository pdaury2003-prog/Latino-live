-- Every profile gets a short public number of exactly seven digits, so people
-- can share "mi número" instead of a long technical identifier.

create sequence if not exists public.profile_number_seq start 1000000;

alter table public.profiles add column if not exists user_number integer;

/** Next free seven digit number; collisions are practically impossible but skipped. */
create or replace function public.next_user_number()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate integer;
begin
  loop
    candidate := nextval('public.profile_number_seq')::integer;
    if candidate > 9999999 then
      candidate := 1000000 + floor(random() * 9000000)::integer;
    end if;
    exit when not exists (select 1 from public.profiles where user_number = candidate);
  end loop;
  return candidate;
end;
$$;

-- Give one to the profiles that already exist, newest last so numbers stay tidy.
do $$
declare row_id uuid;
begin
  for row_id in select id from public.profiles where user_number is null order by created_at loop
    update public.profiles set user_number = public.next_user_number() where id = row_id;
  end loop;
end $$;

alter table public.profiles alter column user_number set default public.next_user_number();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_user_number_key') then
    alter table public.profiles add constraint profiles_user_number_key unique (user_number);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_user_number_range') then
    alter table public.profiles add constraint profiles_user_number_range check (user_number between 1000000 and 9999999);
  end if;
end $$;

-- New accounts get theirs as they are created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, user_number)
  values (
    new.id,
    left(coalesce(nullif(split_part(new.email, '@', 1), ''), 'Invitado'), 32),
    public.next_user_number()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

/** Looks up a person by their seven digit number, for adding by number. */
create or replace function public.profile_by_number(p_number integer)
returns table (id uuid, display_name text, avatar_url text, user_number integer, level integer, svip_level integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_url, p.user_number, p.level, coalesce(p.svip_level, 0)
    from public.profiles p
   where p.user_number = p_number
   limit 1;
$$;
grant execute on function public.profile_by_number(integer) to authenticated;
