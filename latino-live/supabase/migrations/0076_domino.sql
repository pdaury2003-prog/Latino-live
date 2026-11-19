-- Domino: mesas de 2 o 4 jugadores con turnos y reglas en el servidor.
--
-- The table row is public to signed-in people so every phone can follow the
-- board, but each hand lives in its own row that only its owner can read, and
-- the stock has no policy at all. Only the functions below write, so nobody can
-- play out of turn or look at another player's tiles.

create table if not exists public.domino_tables (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  seats integer not null check (seats in (2, 4)),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  turn_seat integer not null default 0,
  passes integer not null default 0,
  board jsonb not null default '[]'::jsonb,
  left_pip integer,
  right_pip integer,
  winner uuid references public.profiles (id) on delete set null,
  reason text,
  log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.domino_players (
  table_id uuid not null references public.domino_tables (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seat_no integer not null,
  tiles_left integer not null default 0,
  joined_at timestamptz not null default now(),
  primary key (table_id, user_id),
  unique (table_id, seat_no)
);

create table if not exists public.domino_hands (
  table_id uuid not null references public.domino_tables (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tiles text[] not null default '{}',
  primary key (table_id, user_id)
);

-- The tiles nobody has drawn yet. No policy: only the functions touch it.
create table if not exists public.domino_deck (
  table_id uuid primary key references public.domino_tables (id) on delete cascade,
  tiles text[] not null default '{}'
);

alter table public.domino_tables enable row level security;
alter table public.domino_players enable row level security;
alter table public.domino_hands enable row level security;
alter table public.domino_deck enable row level security;

drop policy if exists domino_tables_read on public.domino_tables;
create policy domino_tables_read on public.domino_tables for select to authenticated using (true);

drop policy if exists domino_players_read on public.domino_players;
create policy domino_players_read on public.domino_players for select to authenticated using (true);

drop policy if exists domino_hands_read on public.domino_hands;
create policy domino_hands_read on public.domino_hands for select to authenticated using (user_id = auth.uid());

revoke all on public.domino_tables from anon;
revoke all on public.domino_players from anon;
revoke all on public.domino_hands from anon;
revoke all on public.domino_deck from anon, authenticated;
grant select on public.domino_tables to authenticated;
grant select on public.domino_players to authenticated;
grant select on public.domino_hands to authenticated;

-- A table appears live in every phone that is watching it.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'domino_tables'
  ) then
    alter publication supabase_realtime add table public.domino_tables;
  end if;
end $$;

/** Deals a fresh round to the people already sitting at the table. */
create or replace function public.domino_deal(p_table uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seats integer;
  v_players uuid[];
  v_tiles text[] := '{}';
  v_shuffled text[];
  v_stock text[];
  v_hand jsonb;
  v_i integer;
  v_uid uuid;
  v_a integer;
  v_b integer;
  v_key integer;
  v_best integer := 0;
  v_best_key integer := -1;
  v_tile text;
begin
  select seats into v_seats from public.domino_tables where id = p_table for update;
  if v_seats is null then raise exception 'Esa mesa no existe'; end if;

  select array_agg(user_id order by seat_no) into v_players
    from public.domino_players where table_id = p_table;
  if coalesce(array_length(v_players, 1), 0) <> v_seats then
    raise exception 'Faltan jugadores para empezar';
  end if;

  for a in 0..6 loop
    for b in a..6 loop
      v_tiles := array_append(v_tiles, a::text || '-' || b::text);
    end loop;
  end loop;
  select array_agg(tile order by random()) into v_shuffled from unnest(v_tiles) as tile;

  delete from public.domino_hands where table_id = p_table;
  insert into public.domino_hands (table_id, user_id, tiles)
    select p_table, user_id, '{}' from public.domino_players where table_id = p_table;

  for i in 0..(v_seats * 7 - 1) loop
    v_uid := v_players[(i % v_seats) + 1];
    update public.domino_hands
       set tiles = tiles || v_shuffled[i + 1]
     where table_id = p_table and user_id = v_uid;
  end loop;

  v_stock := coalesce(v_shuffled[(v_seats * 7 + 1):array_length(v_shuffled, 1)], '{}');
  insert into public.domino_deck (table_id, tiles) values (p_table, v_stock)
    on conflict (table_id) do update set tiles = excluded.tiles;

  update public.domino_players set tiles_left = 7 where table_id = p_table;

  -- The highest double opens the table, as in the house game; without a
  -- double, the heaviest tile does.
  for i in 0..array_length(v_players, 1) - 1 loop
    select tiles into v_hand from public.domino_hands
     where table_id = p_table and user_id = v_players[i + 1];
    for v_tile in select jsonb_array_elements_text(v_hand) loop
      v_a := split_part(v_tile, '-', 1)::integer;
      v_b := split_part(v_tile, '-', 2)::integer;
      v_key := case when v_a = v_b then 1000 + v_a else (v_a + v_b) * 10 + v_b end;
      if v_key > v_best_key then
        v_best_key := v_key;
        v_best := i;
      end if;
    end loop;
  end loop;

  update public.domino_tables
     set status = 'playing', turn_seat = v_best, passes = 0,
         board = '[]'::jsonb, left_pip = null, right_pip = null,
         winner = null, reason = null, log = '[]'::jsonb, updated_at = now()
   where id = p_table;
end;
$$;

revoke all on function public.domino_deal(uuid) from public, anon, authenticated;

/** Opens a table for 2 or 4 players. The host already has a seat. */
create or replace function public.domino_create(p_seats integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
begin
  if uid is null then raise exception 'Inicia sesion'; end if;
  if p_seats not in (2, 4) then raise exception 'La mesa es de 2 o 4 jugadores'; end if;

  -- A host who tapped twice comes back to the table already open.
  select id into v_id from public.domino_tables
   where host_id = uid and status = 'waiting' order by created_at desc limit 1;
  if v_id is not null then return v_id; end if;

  insert into public.domino_tables (host_id, seats) values (uid, p_seats) returning id into v_id;
  insert into public.domino_players (table_id, user_id, seat_no) values (v_id, uid, 0);
  return v_id;
end;
$$;

/** Takes the next free seat; the last player to sit deals the round. */
create or replace function public.domino_join(p_table uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_row public.domino_tables;
  v_seat integer;
  v_count integer;
begin
  if uid is null then raise exception 'Inicia sesion'; end if;
  select * into v_row from public.domino_tables where id = p_table for update;
  if not found then raise exception 'Esa mesa no existe'; end if;
  if v_row.status <> 'waiting' then raise exception 'Esa mesa ya empezo'; end if;
  if exists (select 1 from public.domino_players where table_id = p_table and user_id = uid) then return; end if;

  select count(*) into v_count from public.domino_players where table_id = p_table;
  if v_count >= v_row.seats then raise exception 'Esa mesa ya esta llena'; end if;

  select min(s.seat_no) into v_seat
    from generate_series(0, v_row.seats - 1) as s(seat_no)
   where s.seat_no not in (select seat_no from public.domino_players where table_id = p_table);
  insert into public.domino_players (table_id, user_id, seat_no) values (p_table, uid, v_seat);
  update public.domino_tables set updated_at = now() where id = p_table;

  select count(*) into v_count from public.domino_players where table_id = p_table;
  if v_count = v_row.seats then perform public.domino_deal(p_table); end if;
end;
$$;

/** Places one of your tiles on the left or right end. */
create or replace function public.domino_play(p_table uuid, p_tile text, p_side text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_row public.domino_tables;
  v_seat integer;
  v_hand text[];
  v_a integer;
  v_b integer;
  v_left integer;
  v_right integer;
  v_board jsonb;
  v_entry jsonb;
begin
  if uid is null then raise exception 'Inicia sesion'; end if;
  select * into v_row from public.domino_tables where id = p_table for update;
  if not found then raise exception 'Esa mesa no existe'; end if;
  if v_row.status <> 'playing' then raise exception 'La partida no esta en juego'; end if;
  select seat_no into v_seat from public.domino_players where table_id = p_table and user_id = uid;
  if v_seat is null then raise exception 'No estas en esta mesa'; end if;
  if v_seat <> v_row.turn_seat then raise exception 'No es tu turno'; end if;

  select tiles into v_hand from public.domino_hands where table_id = p_table and user_id = uid for update;
  if not (p_tile = any(v_hand)) then raise exception 'Esa ficha no es tuya'; end if;
  v_a := split_part(p_tile, '-', 1)::integer;
  v_b := split_part(p_tile, '-', 2)::integer;

  if jsonb_array_length(v_row.board) = 0 then
    v_board := jsonb_build_array(jsonb_build_object('l', v_a, 'r', v_b));
    v_left := v_a;
    v_right := v_b;
    p_side := 'first';
  elsif p_side = 'left' then
    if v_a = v_row.left_pip then v_left := v_b; v_right := v_row.right_pip;
    elsif v_b = v_row.left_pip then v_left := v_a; v_right := v_row.right_pip;
    else raise exception 'Esa ficha no entra por la izquierda'; end if;
    v_board := jsonb_build_array(jsonb_build_object('l', v_left, 'r', v_row.left_pip)) || v_row.board;
  elsif p_side = 'right' then
    if v_a = v_row.right_pip then v_right := v_b; v_left := v_row.left_pip;
    elsif v_b = v_row.right_pip then v_right := v_a; v_left := v_row.left_pip;
    else raise exception 'Esa ficha no entra por la derecha'; end if;
    v_board := v_row.board || jsonb_build_array(jsonb_build_object('l', v_row.right_pip, 'r', v_right));
  else
    raise exception 'Elige un lado';
  end if;

  v_hand := array_remove(v_hand, p_tile);
  update public.domino_hands set tiles = v_hand where table_id = p_table and user_id = uid;
  update public.domino_players set tiles_left = cardinality(v_hand) where table_id = p_table and user_id = uid;

  v_entry := jsonb_build_object('kind', 'play', 'user', uid, 'tile', p_tile, 'side', p_side, 'at', now());

  if cardinality(v_hand) = 0 then
    update public.domino_tables
       set board = v_board, left_pip = v_left, right_pip = v_right,
           status = 'finished', winner = uid, reason = 'Se quedo sin fichas',
           log = log || jsonb_build_array(v_entry), passes = 0, updated_at = now()
     where id = p_table;
  else
    update public.domino_tables
       set board = v_board, left_pip = v_left, right_pip = v_right,
           turn_seat = (v_seat + 1) % seats, passes = 0,
           log = log || jsonb_build_array(v_entry), updated_at = now()
     where id = p_table;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

/**
 * Passes the turn. With tiles left in the stock it draws one and gives the
 * same player another look, which is how the house game is played.
 */
create or replace function public.domino_pass(p_table uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_row public.domino_tables;
  v_seat integer;
  v_stock text[];
  v_tile text;
  v_hand text[];
  v_best uuid;
  v_best_pips integer := 999;
  v_tied boolean := false;
  v_pips integer;
  v_entry jsonb;
  r record;
begin
  if uid is null then raise exception 'Inicia sesion'; end if;
  select * into v_row from public.domino_tables where id = p_table for update;
  if not found then raise exception 'Esa mesa no existe'; end if;
  if v_row.status <> 'playing' then raise exception 'La partida no esta en juego'; end if;
  select seat_no into v_seat from public.domino_players where table_id = p_table and user_id = uid;
  if v_seat is null then raise exception 'No estas en esta mesa'; end if;
  if v_seat <> v_row.turn_seat then raise exception 'No es tu turno'; end if;

  select tiles into v_stock from public.domino_deck where table_id = p_table for update;
  if coalesce(array_length(v_stock, 1), 0) > 0 then
    v_tile := v_stock[1];
    update public.domino_deck set tiles = v_stock[2:array_length(v_stock, 1)] where table_id = p_table;
    select tiles into v_hand from public.domino_hands where table_id = p_table and user_id = uid for update;
    update public.domino_hands set tiles = v_hand || v_tile where table_id = p_table and user_id = uid;
    update public.domino_players set tiles_left = cardinality(v_hand) + 1 where table_id = p_table and user_id = uid;
    v_entry := jsonb_build_object('kind', 'draw', 'user', uid, 'at', now());
    update public.domino_tables set log = log || jsonb_build_array(v_entry), updated_at = now() where id = p_table;
    return jsonb_build_object('drew', true, 'tile', v_tile);
  end if;

  v_entry := jsonb_build_object('kind', 'pass', 'user', uid, 'at', now());
  if v_row.passes + 1 >= v_row.seats then
    for r in
      select h.user_id, coalesce(sum(split_part(t, '-', 1)::integer + split_part(t, '-', 2)::integer), 0) as pips
        from public.domino_hands h, unnest(h.tiles) as t
       where h.table_id = p_table
       group by h.user_id
       order by pips asc
    loop
      if r.pips < v_best_pips then
        v_best_pips := r.pips;
        v_best := r.user_id;
        v_tied := false;
      elsif r.pips = v_best_pips then
        v_tied := true;
      end if;
    end loop;

    update public.domino_tables
       set status = 'finished', passes = v_row.passes + 1,
           winner = case when v_tied then null else v_best end,
           reason = case when v_tied then 'Mesa trancada: empate' else 'Mesa trancada: menos puntos' end,
           log = log || jsonb_build_array(v_entry), updated_at = now()
     where id = p_table;
    return jsonb_build_object('drew', false, 'finished', true, 'tied', v_tied, 'winner', v_best);
  end if;

  update public.domino_tables
     set turn_seat = (v_seat + 1) % seats, passes = v_row.passes + 1,
         log = log || jsonb_build_array(v_entry), updated_at = now()
   where id = p_table;
  return jsonb_build_object('drew', false, 'finished', false);
end;
$$;

/** Gives up the seat. A game in progress ends, so nobody waits for a ghost. */
create or replace function public.domino_leave(p_table uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_row public.domino_tables;
  v_next uuid;
  v_count integer;
begin
  if uid is null then raise exception 'Inicia sesion'; end if;
  select * into v_row from public.domino_tables where id = p_table for update;
  if not found then return; end if;
  if not exists (select 1 from public.domino_players where table_id = p_table and user_id = uid) then return; end if;

  delete from public.domino_hands where table_id = p_table and user_id = uid;
  delete from public.domino_players where table_id = p_table and user_id = uid;

  if v_row.status = 'playing' then
    update public.domino_tables
       set status = 'finished', winner = null, reason = 'Un jugador salio de la mesa', updated_at = now()
     where id = p_table;
    return;
  end if;

  select count(*) into v_count from public.domino_players where table_id = p_table;
  if v_count = 0 then
    delete from public.domino_tables where id = p_table;
    return;
  end if;
  if v_row.host_id = uid then
    select user_id into v_next from public.domino_players where table_id = p_table order by seat_no limit 1;
    update public.domino_tables set host_id = v_next, updated_at = now() where id = p_table;
  end if;
end;
$$;

/** Same people, a fresh round; only the host starts it. */
create or replace function public.domino_rematch(p_table uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_row public.domino_tables;
  v_count integer;
begin
  if uid is null then raise exception 'Inicia sesion'; end if;
  select * into v_row from public.domino_tables where id = p_table for update;
  if not found then raise exception 'Esa mesa no existe'; end if;
  if v_row.host_id <> uid then raise exception 'Solo el anfitrion reparte otra vez'; end if;
  if v_row.status <> 'finished' then raise exception 'La partida sigue en juego'; end if;
  select count(*) into v_count from public.domino_players where table_id = p_table;
  if v_count <> v_row.seats then raise exception 'Falta un jugador para la revancha'; end if;
  perform public.domino_deal(p_table);
end;
$$;

revoke all on function public.domino_create(integer) from public, anon;
revoke all on function public.domino_join(uuid) from public, anon;
revoke all on function public.domino_play(uuid, text, text) from public, anon;
revoke all on function public.domino_pass(uuid) from public, anon;
revoke all on function public.domino_leave(uuid) from public, anon;
revoke all on function public.domino_rematch(uuid) from public, anon;

grant execute on function public.domino_create(integer) to authenticated;
grant execute on function public.domino_join(uuid) to authenticated;
grant execute on function public.domino_play(uuid, text, text) to authenticated;
grant execute on function public.domino_pass(uuid) to authenticated;
grant execute on function public.domino_leave(uuid) to authenticated;
grant execute on function public.domino_rematch(uuid) to authenticated;
