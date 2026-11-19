-- The wallet shows where the money came from: diamond packs paid by card,
-- gold turned into diamonds, and gold received from gifts. Purchases and gifts
-- are already recorded elsewhere, so only the exchanges need a ledger; one
-- function then reads the three sources in a single, ordered list.

create table if not exists public.gold_conversions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  gold integer not null check (gold > 0),
  diamonds integer not null check (diamonds > 0),
  created_at timestamptz not null default now()
);

create index if not exists gold_conversions_user_time
  on public.gold_conversions (user_id, created_at desc);

alter table public.gold_conversions enable row level security;

drop policy if exists gold_conversions_read on public.gold_conversions;
create policy gold_conversions_read on public.gold_conversions
  for select to authenticated using (user_id = auth.uid());

grant select on public.gold_conversions to authenticated;

-- The same exchange as before, now leaving a line the wallet can show.
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
  spent integer;
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
  spent := gained * rate;
  update public.profiles p
     set gold = p.gold - spent,
         diamonds = coalesce(p.diamonds, 0) + gained
   where p.id = uid;
  insert into public.gold_conversions (user_id, gold, diamonds)
    values (uid, spent, gained);
  return query
    select p.gold, p.diamonds from public.profiles p where p.id = uid;
end;
$$;

grant execute on function public.convert_gold(integer) to authenticated;

-- One list for the wallet: a purchase, an exchange or a gift, newest first.
create or replace function public.wallet_history(p_limit integer default 40)
returns table (
  entry_kind text,
  at timestamptz,
  diamonds integer,
  gold integer,
  title text,
  note text,
  amount_minor integer,
  currency text
)
language sql
security definer
set search_path = public
stable
as $$
  with me as (select auth.uid() as uid)
  select * from (
    select
      'compra'::text as entry_kind,
      c.credited_at as at,
      c.amount as diamonds,
      0 as gold,
      'Recarga de diamantes'::text as title,
      'Pagaste con tarjeta'::text as note,
      o.amount::integer as amount_minor,
      o.currency
    from public.diamond_claims c
    join me on me.uid = c.user_id
    left join public.spk_payment_entitlements e on e.id = c.entitlement_id
    left join public.spk_payment_orders o on o.id = e.source_id and o.user_id = c.user_id

    union all

    select
      'cambio'::text,
      g.created_at,
      g.diamonds,
      -g.gold,
      'Cambio de oro'::text,
      g.gold::text || ' de oro por ' || g.diamonds::text || ' diamantes',
      null::integer,
      null::text
    from public.gold_conversions g
    join me on me.uid = g.user_id

    union all

    -- A gift pays gold to the person it names, or to the host of that room.
    select
      'regalo'::text,
      g.created_at,
      0,
      floor(g.cost * 100 * 0.7)::integer,
      'Regalo de ' || coalesce(g.sender_name, 'alguien'),
      'Oro recibido en tu sala'::text,
      null::integer,
      null::text
    from public.room_gifts g
    join public.rooms r on r.id = g.room_id
    join me on me.uid = coalesce(g.recipient_id, r.host_id)
    where floor(g.cost * 100 * 0.7) > 0
  ) entries
  order by at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$$;

grant execute on function public.wallet_history(integer) to authenticated;
