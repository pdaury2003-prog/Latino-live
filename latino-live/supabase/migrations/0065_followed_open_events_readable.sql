-- The live notice of a followed person opening a room reads this table from
-- the phone. With row level security on and no read rule, the realtime socket
-- delivered nothing and the card only appeared on the next full reload.
--
-- The rule is exactly what the notice shows: the openings of the people this
-- account follows. Nobody can browse the openings of strangers.

drop policy if exists "a follower reads the openings they follow" on public.room_open_events;
create policy "a follower reads the openings they follow" on public.room_open_events
  for select to authenticated
  using (
    exists (
      select 1
        from public.profile_follows f
       where f.follower_id = auth.uid()
         and f.following_id = room_open_events.host_id
    )
  );
