-- Motor de juegos: mesas compartidas en la sala y casino privado por persona.
--
-- Reglas de dinero:
--  * El saldo vive en public.profiles.diamonds y solo lo mueven estas
--    funciones, con la fila bloqueada (for update). El teléfono nunca escribe
--    un saldo ni un premio.
--  * Cada mesa guarda cuánto se cobró y cuánto se pagó a cada persona, así que
--    repetir una llamada no cobra dos veces.
--  * Hay un tope diario configurable en game_settings.
--  * Las mesas de salón son visibles para quien está en la sala; las de casino
--    solo las ve su dueño.

create table if not exists public.game_settings (
  id boolean primary key default true check (id),
  min_bet integer not null default 1 check (min_bet > 0),
  max_bet integer not null default 5000 check (max_bet >= min_bet),
  max_daily integer not null default 20000 check (max_daily >= max_bet),
  updated_at timestamptz not null default now()
);

insert into public.game_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.game_tables (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms (id) on delete cascade,
  kind text not null check (kind in ('chess', 'checkers', 'ludo', 'domino', 'slots', 'poker', 'roulette', 'blackjack')),
  visibility text not null check (visibility in ('table', 'private')),
  owner_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'playing' check (status in ('playing', 'finished')),
  stake integer not null default 0 check (stake >= 0),
  seats jsonb not null default '[]'::jsonb,
  state jsonb not null default '{}'::jsonb,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_tables_kind_visibility check (
    (visibility = 'table' and kind in ('chess', 'checkers', 'ludo', 'domino'))
    or (visibility = 'private' and kind in ('slots', 'poker', 'roulette', 'blackjack'))
  )
);

create index if not exists game_tables_room_status on public.game_tables (room_id, status, created_at desc);
create index if not exists game_tables_owner_time on public.game_tables (owner_id, created_at desc);

create table if not exists public.game_bets (
  table_id uuid not null references public.game_tables (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  charged integer not null default 0 check (charged >= 0),
  credited integer not null default 0 check (credited >= 0),
  updated_at timestamptz not null default now(),
  primary key (table_id, user_id)
);

create table if not exists public.game_wallet_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  table_id uuid references public.game_tables (id) on delete set null,
  room_id uuid references public.rooms (id) on delete set null,
  kind text not null check (kind in ('bet', 'win')),
  amount integer not null,
  balance_after integer not null check (balance_after >= 0),
  created_at timestamptz not null default now()
);

create index if not exists game_wallet_entries_user_time
  on public.game_wallet_entries (user_id, created_at desc);

alter table public.game_settings enable row level security;
alter table public.game_tables enable row level security;
alter table public.game_bets enable row level security;
alter table public.game_wallet_entries enable row level security;

drop policy if exists game_settings_read on public.game_settings;
create policy game_settings_read on public.game_settings
  for select to authenticated using (true);

-- Una mesa de salón la ve cualquiera que esté sentado en esa sala (o su
-- anfitrión). Una mesa de casino solo la ve quien la abrió.
drop policy if exists game_tables_read on public.game_tables;
create policy game_tables_read on public.game_tables
  for select to authenticated using (
    owner_id = auth.uid()
    or (
      visibility = 'table'
      and room_id is not null
      and (
        exists (
          select 1 from public.room_seats s
           where s.room_id = game_tables.room_id and s.user_id = auth.uid()
        )
        or exists (
          select 1 from public.rooms r
           where r.id = game_tables.room_id and r.host_id = auth.uid()
        )
      )
    )
  );

drop policy if exists game_bets_read on public.game_bets;
create policy game_bets_read on public.game_bets
  for select to authenticated using (user_id = auth.uid());

drop policy if exists game_wallet_entries_read on public.game_wallet_entries;
create policy game_wallet_entries_read on public.game_wallet_entries
  for select to authenticated using (user_id = auth.uid());

grant select on public.game_settings to authenticated;
grant select on public.game_tables to authenticated;
grant select on public.game_bets to authenticated;
grant select on public.game_wallet_entries to authenticated;

-- El motor escribe con la llave de servicio; ninguna persona puede insertar,
-- cambiar ni borrar una mesa o un movimiento de su billetera.
revoke insert, update, delete on public.game_tables from public, anon, authenticated;
revoke insert, update, delete on public.game_bets from public, anon, authenticated;
revoke insert, update, delete on public.game_wallet_entries from public, anon, authenticated;
revoke insert, update, delete on public.game_settings from public, anon, authenticated;

-- Abre una mesa después de comprobar que la persona está en la sala. Devuelve
-- el id para que el servidor la use como autoridad.
create or replace function public.game_open_table(
  p_room uuid,
  p_kind text,
  p_visibility text,
  p_owner uuid,
  p_seats jsonb,
  p_state jsonb,
  p_stake integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if p_owner is null then raise exception 'Falta la persona que abre la mesa'; end if;
  if p_kind not in ('chess', 'checkers', 'ludo', 'domino', 'slots', 'poker', 'roulette', 'blackjack') then
    raise exception 'Ese juego no existe';
  end if;
  if p_visibility not in ('table', 'private') then raise exception 'Esa visibilidad no existe'; end if;
  if (p_visibility = 'table' and p_kind not in ('chess', 'checkers', 'ludo', 'domino'))
     or (p_visibility = 'private' and p_kind not in ('slots', 'poker', 'roulette', 'blackjack')) then
    raise exception 'Ese juego no puede abrirse así';
  end if;
  if p_visibility = 'table' and p_room is null then
    raise exception 'Una mesa de salón necesita una sala';
  end if;
  if p_room is not null then
    if not exists (select 1 from public.rooms r where r.id = p_room) then
      raise exception 'La sala no existe';
    end if;
    if not exists (select 1 from public.room_seats s where s.room_id = p_room and s.user_id = p_owner)
       and not exists (select 1 from public.rooms r where r.id = p_room and r.host_id = p_owner) then
      raise exception 'Tienes que estar en la sala para abrir esa mesa';
    end if;
  end if;

  insert into public.game_tables (room_id, kind, visibility, owner_id, seats, state, stake)
  values (p_room, p_kind, p_visibility, p_owner, coalesce(p_seats, '[]'::jsonb), coalesce(p_state, '{}'::jsonb), greatest(0, coalesce(p_stake, 0)))
  returning id into new_id;
  return new_id;
end;
$$;

-- Guarda el estado calculado por el servidor. La versión evita que dos
-- procesos pisen la misma mesa: si cambió debajo, la llamada falla.
create or replace function public.game_save_table(
  p_table uuid,
  p_state jsonb,
  p_status text,
  p_stake integer,
  p_version integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version integer;
begin
  if p_status not in ('playing', 'finished') then raise exception 'Ese estado no existe'; end if;
  update public.game_tables
     set state = coalesce(p_state, state),
         status = p_status,
         stake = greatest(0, coalesce(p_stake, stake)),
         version = version + 1,
         updated_at = now()
   where id = p_table and version = p_version
  returning version into next_version;
  if next_version is null then
    raise exception 'La mesa cambió mientras se jugaba; vuelve a cargarla';
  end if;
  return next_version;
end;
$$;

-- Cobra la parte nueva de la apuesta. p_total es lo que la persona lleva
-- apostado en esa mesa, no el incremento: repetir la llamada no cobra de más.
create or replace function public.game_charge(
  p_table uuid,
  p_user uuid,
  p_total integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  limits record;
  already integer := 0;
  delta integer;
  v_balance integer;
  daily integer := 0;
  v_room uuid;
begin
  if p_user is null then raise exception 'Falta la persona'; end if;
  if p_total is null or p_total < 0 then raise exception 'Esa apuesta no vale'; end if;
  select * into limits from public.game_settings where id;
  select room_id into v_room from public.game_tables where id = p_table;
  if not found then raise exception 'La mesa no existe'; end if;

  insert into public.game_bets (table_id, user_id) values (p_table, p_user)
  on conflict (table_id, user_id) do nothing;
  select charged into already
    from public.game_bets
   where table_id = p_table and user_id = p_user
   for update;
  already := coalesce(already, 0);
  delta := p_total - already;
  if delta <= 0 then
    select coalesce(diamonds, 0) into v_balance from public.profiles where id = p_user;
    return coalesce(v_balance, 0);
  end if;
  if p_total > limits.max_bet * 6 then
    raise exception 'Esa apuesta supera el máximo de la mesa';
  end if;

  select coalesce(sum(case when amount < 0 then -amount else 0 end), 0) into daily
    from public.game_wallet_entries
   where user_id = p_user
     and kind = 'bet'
     and created_at >= date_trunc('day', now());
  if daily + delta > limits.max_daily then
    raise exception 'Llegaste al límite diario de % diamantes', limits.max_daily;
  end if;

  select coalesce(diamonds, 0) into v_balance from public.profiles where id = p_user for update;
  if v_balance < delta then
    raise exception 'Te faltan diamantes: quieres apostar % y tienes %', delta, v_balance;
  end if;
  update public.profiles set diamonds = diamonds - delta where id = p_user returning diamonds into v_balance;
  update public.game_bets
     set charged = already + delta, updated_at = now()
   where table_id = p_table and user_id = p_user;
  insert into public.game_wallet_entries (user_id, table_id, room_id, kind, amount, balance_after)
  values (p_user, p_table, v_room, 'bet', -delta, v_balance);
  return v_balance;
end;
$$;

-- Devuelve premios y la parte no jugada. p_total es el pago acumulado.
create or replace function public.game_credit(
  p_table uuid,
  p_user uuid,
  p_total integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  already integer := 0;
  delta integer;
  v_balance integer;
  v_room uuid;
begin
  if p_user is null then raise exception 'Falta la persona'; end if;
  if p_total is null or p_total < 0 then raise exception 'Ese premio no vale'; end if;
  select room_id into v_room from public.game_tables where id = p_table;
  if not found then raise exception 'La mesa no existe'; end if;

  insert into public.game_bets (table_id, user_id) values (p_table, p_user)
  on conflict (table_id, user_id) do nothing;
  select credited into already
    from public.game_bets
   where table_id = p_table and user_id = p_user
   for update;
  already := coalesce(already, 0);
  delta := p_total - already;
  if delta <= 0 then
    select coalesce(diamonds, 0) into v_balance from public.profiles where id = p_user;
    return coalesce(v_balance, 0);
  end if;

  update public.profiles set diamonds = coalesce(diamonds, 0) + delta where id = p_user returning diamonds into v_balance;
  update public.game_bets
     set credited = already + delta, updated_at = now()
   where table_id = p_table and user_id = p_user;
  insert into public.game_wallet_entries (user_id, table_id, room_id, kind, amount, balance_after)
  values (p_user, p_table, v_room, 'win', delta, v_balance);
  return v_balance;
end;
$$;

-- Solo el servidor del motor mueve dinero o mesas.
revoke all on function public.game_open_table(uuid, text, text, uuid, jsonb, jsonb, integer) from public, anon, authenticated;
revoke all on function public.game_save_table(uuid, jsonb, text, integer, integer) from public, anon, authenticated;
revoke all on function public.game_charge(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.game_credit(uuid, uuid, integer) from public, anon, authenticated;

grant execute on function public.game_open_table(uuid, text, text, uuid, jsonb, jsonb, integer) to service_role;
grant execute on function public.game_save_table(uuid, jsonb, text, integer, integer) to service_role;
grant execute on function public.game_charge(uuid, uuid, integer) to service_role;
grant execute on function public.game_credit(uuid, uuid, integer) to service_role;

-- El historial del casino para la billetera, separado del historial de regalos.
create or replace function public.game_wallet_history(p_limit integer default 40)
returns table (entry_kind text, at timestamptz, amount integer, balance_after integer, room_id uuid, table_id uuid)
language sql
security definer
set search_path = public
stable
as $$
  select e.kind, e.created_at, e.amount, e.balance_after, e.room_id, e.table_id
    from public.game_wallet_entries e
   where e.user_id = auth.uid()
   order by e.created_at desc
   limit greatest(1, least(coalesce(p_limit, 40), 100));
$$;

revoke all on function public.game_wallet_history(integer) from public, anon;
grant execute on function public.game_wallet_history(integer) to authenticated;

-- La app escucha las mesas de su sala como ya escucha asientos y mensajes.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_tables'
  ) then
    alter publication supabase_realtime add table public.game_tables;
  end if;
end;
$$;
