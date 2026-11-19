-- auth.users.email is a varchar, and a table function must return exactly the
-- types it declares: the email column is cast to text so the lookup works.

create or replace function public.staff_identity(p_identifier text)
returns table (user_id uuid, email text)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  clean text := btrim(coalesce(p_identifier, ''));
  matches integer;
  found_id uuid;
begin
  if clean = '' then raise exception 'Escribe tu usuario'; end if;

  if position('@' in clean) > 0 then
    return query
      select u.id, u.email::text from auth.users u where lower(u.email) = lower(clean) limit 1;
    if not found then raise exception 'No hay ninguna cuenta con ese correo'; end if;
    return;
  end if;

  select count(*) into matches from public.profiles p where p.display_name ilike clean;
  if matches = 0 then raise exception 'No hay ninguna cuenta con ese usuario';
  elsif matches > 1 then raise exception 'Hay mas de una cuenta con ese nombre. Entra con tu correo';
  end if;

  select p.id into found_id from public.profiles p where p.display_name ilike clean limit 1;
  return query
    select u.id, u.email::text from auth.users u where u.id = found_id limit 1;
  if not found then raise exception 'Esa cuenta no tiene correo de acceso'; end if;
end;
$$;

revoke all on function public.staff_identity(text) from public, anon, authenticated;
grant execute on function public.staff_identity(text) to service_role;

create or replace function public.staff_email_for(p_identifier text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select i.email from public.staff_identity(p_identifier) i limit 1;
$$;

revoke all on function public.staff_email_for(text) from public, anon, authenticated;
grant execute on function public.staff_email_for(text) to service_role;
