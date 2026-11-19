-- Las agencias del panel: una fila por persona que representa a una agencia,
-- con los diamantes que ha recibido en regalos. El panel las agrupa por el
-- nombre de la agencia y suma el total.

create or replace function public.admin_agency_people()
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  level integer,
  diamonds integer,
  agency_name text,
  assigned_badge text,
  diamonds_received bigint,
  diamonds_received_30d bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then raise exception 'No tienes acceso al panel'; end if;
  return query
    select p.id, p.display_name, p.avatar_url, p.level, p.diamonds,
           p.agency_name,
           p.badge,
           coalesce((select sum(g.cost) from public.room_gifts g where g.recipient_id = p.id), 0)::bigint,
           coalesce((select sum(g.cost) from public.room_gifts g
                      where g.recipient_id = p.id and g.created_at > now() - interval '30 days'), 0)::bigint
      from public.profiles p
     where p.agency_name is not null or p.badge = 'agency'
     order by p.agency_name nulls last, p.created_at;
end;
$$;

revoke all on function public.admin_agency_people() from public, anon;
grant execute on function public.admin_agency_people() to authenticated;
