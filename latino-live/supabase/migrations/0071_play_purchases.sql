-- Diamond packs bought inside Google Play.
--
-- Google requires digital goods sold inside an app to be paid with Play
-- Billing, and the phone alone can never be trusted to say "I paid": a phone
-- can send any token it likes. So the order is always the same:
--
--   1. the phone buys with Play Billing and receives a purchase token;
--   2. the server asks Google about that token (Edge Function `play-purchase`);
--   3. only when Google says the purchase is real does the server credit the
--      diamonds, once per token.
--
-- This table is that ledger: one row per token, written only by the server.

create table if not exists public.play_purchases (
  purchase_token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  amount integer not null check (amount > 0),
  order_id text,
  price_micros bigint,
  currency text,
  purchased_at timestamptz,
  verified_at timestamptz not null default now(),
  credited_at timestamptz,
  state text not null default 'credited' check (state in ('credited', 'refunded'))
);

create index if not exists play_purchases_user_time
  on public.play_purchases (user_id, verified_at desc);

alter table public.play_purchases enable row level security;

-- A person may read their own purchases; nobody can write from the phone.
drop policy if exists play_purchases_read on public.play_purchases;
create policy play_purchases_read on public.play_purchases
  for select to authenticated using (user_id = auth.uid());

grant select on public.play_purchases to authenticated;

/**
 * Credits a purchase Google already confirmed. Idempotent by token: the same
 * purchase can never add diamonds twice, and a token that belongs to another
 * account is refused instead of silently ignored.
 */
create or replace function public.credit_play_purchase(
  p_token text,
  p_user uuid,
  p_product text,
  p_amount integer,
  p_order text default null,
  p_price_micros bigint default null,
  p_currency text default null,
  p_purchased_at timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer := 0;
  token text := btrim(coalesce(p_token, ''));
begin
  if p_user is null then raise exception 'Falta el usuario'; end if;
  if length(token) < 8 then raise exception 'Token de compra invalido'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Monto invalido'; end if;

  insert into public.play_purchases (
    purchase_token, user_id, product_id, amount, order_id,
    price_micros, currency, purchased_at, credited_at
  )
  values (
    token, p_user, coalesce(p_product, ''), p_amount, p_order,
    p_price_micros, p_currency, p_purchased_at, now()
  )
  on conflict (purchase_token) do nothing;

  get diagnostics inserted = row_count;

  if inserted = 0 then
    if exists (
      select 1 from public.play_purchases
       where purchase_token = token and user_id <> p_user
    ) then
      raise exception 'Esa compra ya fue usada por otra cuenta';
    end if;
    -- Already credited to this account: the retry is a success, not a charge.
    return 0;
  end if;

  update public.profiles
     set diamonds = coalesce(diamonds, 0) + p_amount
   where id = p_user;

  return p_amount;
end;
$$;

revoke all on function public.credit_play_purchase(text, uuid, text, integer, text, bigint, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.credit_play_purchase(text, uuid, text, integer, text, bigint, text, timestamptz)
  to service_role;

-- The wallet shows Play purchases beside the card ones, so a person can see
-- where every diamond came from no matter how it was paid.
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
      'Pagaste con Google Play'::text,
      case when p.price_micros is null then null else (p.price_micros / 1000)::integer end,
      p.currency
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
