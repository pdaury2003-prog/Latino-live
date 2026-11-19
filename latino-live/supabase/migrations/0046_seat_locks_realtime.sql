-- A padlock must reach every phone in the room at once, like a seat does.
do $$
begin
  alter publication supabase_realtime add table public.room_seat_locks;
exception
  when duplicate_object then null;
end $$;
