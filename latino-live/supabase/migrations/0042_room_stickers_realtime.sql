-- A sticker event is filtered by its room, and Realtime only filters on
-- columns it is told to carry: with the full row every phone in the room
-- receives the exact seat pair the sender wrote.

alter table public.room_stickers replica identity full;

grant select, insert on public.room_stickers to authenticated;
grant usage, select on sequence public.room_stickers_id_seq to authenticated;
