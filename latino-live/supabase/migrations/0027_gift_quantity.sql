-- Gifts are bought by the bundle: one row, one charge, one message.
create or replace function public.send_gift_quantity(p_room uuid, p_gift text, p_recipient uuid, p_qty integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gift public.gift_catalog;
  qty integer := greatest(1, least(999, coalesce(p_qty, 1)));
  total integer;
  balance integer;
  sender text;
  target text;
  host uuid;
  payee uuid;
begin
  if uid is null then raise exception 'Inicia sesión para enviar un regalo'; end if;
  select * into gift from public.gift_catalog where key = p_gift;
  if gift.key is null then raise exception 'Ese regalo no existe'; end if;
  if not exists (select 1 from public.rooms where id = p_room) then raise exception 'La sala ya no existe'; end if;

  if p_recipient is not null then
    if p_recipient = uid then raise exception 'No puedes regalarte a ti mismo'; end if;
    select display_name into target from public.room_seats where room_id = p_room and user_id = p_recipient;
    if target is null then raise exception 'Esa persona ya no está en la sala'; end if;
  end if;

  total := gift.cost * qty;

  update public.profiles set diamonds = diamonds - total
  where id = uid and diamonds >= total
  returning diamonds, display_name into balance, sender;
  if balance is null then raise exception 'No tienes suficientes diamantes'; end if;

  if p_recipient is not null then
    payee := p_recipient;
  else
    select host_id into payee from public.rooms where id = p_room;
  end if;

  if payee is not null and payee <> uid then
    update public.profiles set gold = gold + floor(total * 100 * 0.7) where id = payee;
  end if;

  insert into public.room_gifts (room_id, sender_id, sender_name, gift_key, cost, recipient_id, recipient_name)
  values (p_room, uid, sender, gift.key, total, p_recipient, target);

  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (
    p_room, uid, sender, 'gift',
    sender || ' envió '
      || case when qty > 1 then qty || ' × ' else '' end
      || gift.name
      || case when target is null then ' a la sala' else ' a ' || target end
  );
  return balance;
end;
$$;

grant execute on function public.send_gift_quantity(uuid, text, uuid, integer) to authenticated;
