-- The app is now Latino Live: the official rooms and their welcome text carry
-- the new name, and new official content starts from it.

alter table public.rooms alter column host_name set default 'Latino Live';

update public.rooms
   set host_name = 'Latino Live'
 where host_name = 'Sahar';

update public.rooms
   set announcement = replace(announcement, 'Sahar', 'Latino Live')
 where announcement like '%Sahar%';

update public.room_messages
   set body = replace(body, 'Sahar', 'Latino Live')
 where body like '%Sahar%';
