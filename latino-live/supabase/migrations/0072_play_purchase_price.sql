-- Google reports a purchase's price in micros (1.000.000 micros = 1 unidad).
-- Converting that to cents by dividing by 1000 multiplied the amount by ten, so
-- the wallet showed "$9,90" for a $0,99 pack. Google also returns the price
-- already formatted for the buyer's currency ("$0,99"), which is exact for
-- every currency (some use no decimals, some three). That text is kept and
-- shown as-is, and the micros stay as a record.

alter table public.play_purchases add column if not exists price_text text;

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
      'compra'::text,
      p.credited_at,
      p.amount,
      0,
      'Recarga de diamantes'::text,
      'Pagaste con Google Play'::text || coalesce(' · ' || p.price_text, ''),
      -- Only fall back to the stored micros when Google gave no readable price;
      -- one cent is 10.000 micros, not 1.000.
      case
        when p.price_text is not null then null
        when p.price_micros is not null then (p.price_micros / 10000)::integer
        else null
      end,
      case when p.price_text is not null then null else p.currency end
    from public.play_purchases p
    join me on me.uid = p.user_id
    where p.state = 'credited'

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
