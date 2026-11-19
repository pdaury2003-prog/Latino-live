-- Gold earned from gifts can be turned into diamonds at 100 gold = 1 diamond.
-- The rate and the arithmetic live here, so the phone cannot send its own.

create or replace function public.gold_rate()
returns integer
language sql
immutable
as $$ select 100 $$;

create or replace function public.convert_gold(p_gold integer)
returns table (gold integer, diamonds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rate integer := public.gold_rate();
  budget integer;
  gained integer;
begin
  if uid is null then raise exception 'Inicia sesion'; end if;
  if p_gold is null or p_gold <= 0 then raise exception 'Escribe cuanto oro quieres cambiar'; end if;
  select coalesce(p.gold, 0) into budget from public.profiles p where p.id = uid for update;
  if budget < p_gold then
    raise exception 'Solo tienes % de oro', budget;
  end if;
  gained := p_gold / rate;
  if gained < 1 then
    raise exception 'Necesitas al menos % de oro para un diamante', rate;
  end if;
  -- Only the gold that actually buys a diamond leaves the wallet; the rest stays.
  update public.profiles p
     set gold = p.gold - (gained * rate),
         diamonds = coalesce(p.diamonds, 0) + gained
   where p.id = uid;
  return query
    select p.gold, p.diamonds from public.profiles p where p.id = uid;
end;
$$;

grant execute on function public.convert_gold(integer) to authenticated;
grant execute on function public.gold_rate() to anon, authenticated;
