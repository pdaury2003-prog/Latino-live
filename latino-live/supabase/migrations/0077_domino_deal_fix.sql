-- The deal read a text[] into a jsonb variable, which Postgres tried to parse
-- as JSON and refused. It now reads the hand as text[] and walks it plainly.

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
  v_hand text[];
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

  -- The highest double opens the table; without a double, the heaviest tile.
  for i in 0..array_length(v_players, 1) - 1 loop
    select tiles into v_hand from public.domino_hands
     where table_id = p_table and user_id = v_players[i + 1];
    foreach v_tile in array v_hand loop
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
    update public.domino_deck set tiles = v_stock[2:] where table_id = p_table;
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

revoke all on function public.domino_deal(uuid) from public, anon, authenticated;
revoke all on function public.domino_pass(uuid) from public, anon;
grant execute on function public.domino_pass(uuid) to authenticated;
