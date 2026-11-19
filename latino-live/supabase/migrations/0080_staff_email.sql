-- El panel entra con el usuario de la cuenta ("nanao") y no con el correo.
-- Esta función traduce uno al otro para el servidor del panel; solo el rol de
-- servicio puede llamarla, así que ningún teléfono puede usarla para averiguar
-- correos ajenos.

create or replace function public.staff_email_for(p_identifier text)
returns text
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  clean text := btrim(coalesce(p_identifier, ''));
  matches integer;
  found_id uuid;
  found_email text;
begin
  if clean = '' then raise exception 'Escribe tu usuario'; end if;
  if position('@' in clean) > 0 then return lower(clean); end if;

  select count(*) into matches from public.profiles p where p.display_name ilike clean;
  if matches = 0 then raise exception 'No hay ninguna cuenta con ese usuario';
  elsif matches > 1 then raise exception 'Hay mas de una cuenta con ese nombre. Entra con tu correo'; end if;

  select p.id into found_id from public.profiles p where p.display_name ilike clean limit 1;
  select u.email into found_email from auth.users u where u.id = found_id;
  if found_email is null then raise exception 'Esa cuenta no tiene correo de acceso'; end if;
  return found_email;
end;
$$;

revoke all on function public.staff_email_for(text) from public, anon, authenticated;
grant execute on function public.staff_email_for(text) to service_role;
