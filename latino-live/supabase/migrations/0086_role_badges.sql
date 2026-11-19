-- Insignias de rol junto al nombre: Agencia, Host, Oficial, Dueño, Super Admin
-- y Atención al cliente (CS). El dueño asigna las que no se derivan solas
-- (agencia, oficial, CS); dueño, super admin y host salen de los hechos: el rol
-- de equipo y quién es anfitrión de una sala abierta.

alter table public.profiles add column if not exists badge text;

alter table public.profiles drop constraint if exists profiles_badge_check;
alter table public.profiles add constraint profiles_badge_check
  check (badge is null or badge in ('agency', 'official', 'cs'));

/**
 * La insignia de cada persona, ya resuelta. La más alta gana: dueño, super
 * admin, agencia, oficial, atención al cliente y, por último, anfitrión de
 * alguna sala abierta.
 */
create or replace function public.profile_badges(p_users uuid[])
returns table (user_id uuid, badge text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         case
           when r.role = 'owner' then 'owner'
           when r.role = 'admin' then 'super-admin'
           when p.badge = 'agency' then 'agency'
           when p.badge = 'official' then 'official'
           when p.badge = 'cs' or r.role = 'moderator' then 'cs'
           when exists (
             select 1 from public.rooms ro
              where ro.host_id = p.id and ro.closed_at is null
           ) then 'host'
           else null
         end
    from public.profiles p
    left join public.app_roles r on r.user_id = p.id
   where p.id = any(coalesce(p_users, '{}'::uuid[]));
$$;

revoke all on function public.profile_badges(uuid[]) from public, anon;
grant execute on function public.profile_badges(uuid[]) to authenticated;

/** Solo el dueño cambia una insignia; todo queda en la auditoría. */
create or replace function public.admin_set_badge(p_user uuid, p_badge text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean text := nullif(btrim(coalesce(p_badge, '')), '');
  target_name text;
begin
  if public.staff_rank(public.my_staff_role()) < 3 then
    raise exception 'Solo el dueno cambia las insignias';
  end if;
  if p_user = auth.uid() then raise exception 'Tu propia insignia es la de dueno'; end if;
  if clean is not null and clean not in ('agency', 'official', 'cs') then
    raise exception 'Esa insignia no existe';
  end if;
  select display_name into target_name from public.profiles where id = p_user;
  if target_name is null then raise exception 'Esa cuenta no existe'; end if;

  update public.profiles set badge = clean where id = p_user;
  perform public.admin_log(
    'badge_set', p_user, target_name,
    case clean
      when 'agency' then 'Insignia de Agencia'
      when 'official' then 'Insignia de Oficial'
      when 'cs' then 'Insignia de Atencion al cliente'
      else 'Sin insignia'
    end
  );
end;
$$;

revoke all on function public.admin_set_badge(uuid, text) from public, anon;
grant execute on function public.admin_set_badge(uuid, text) to authenticated;
