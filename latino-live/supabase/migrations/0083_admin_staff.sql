-- Quién puede entrar al panel. Devuelve una fila por persona con rol, sin
-- correos ni contraseñas: el nombre, su número de cuenta, el rol y desde cuándo.

create or replace function public.admin_staff()
returns table (
  user_id uuid,
  display_name text,
  user_number integer,
  avatar_url text,
  role text,
  granted_by_name text,
  since timestamptz,
  banned boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then raise exception 'No tienes acceso al panel'; end if;
  return query
    select r.user_id,
           coalesce(p.display_name, 'Cuenta')::text,
           p.user_number,
           p.avatar_url,
           r.role,
           g.display_name,
           r.created_at,
           (b.user_id is not null and (b.until is null or b.until > now()))
      from public.app_roles r
      left join public.profiles p on p.id = r.user_id
      left join public.profiles g on g.id = r.granted_by
      left join public.account_bans b on b.user_id = r.user_id
     order by public.staff_rank(r.role) desc, r.created_at asc;
end;
$$;

revoke all on function public.admin_staff() from public, anon;
grant execute on function public.admin_staff() to authenticated;
