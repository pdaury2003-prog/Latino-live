-- A person can send one notice to their own phones to see that it arrives with
-- the app closed. It only ever reaches the account that asks for it.

create or replace function public.push_test()
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  messages jsonb;
begin
  if uid is null then return false; end if;

  select jsonb_agg(jsonb_build_object(
           'to', t.token,
           'title', 'Latino Live',
           'body', 'Los avisos funcionan: así te llegará cuando un seguido abra una sala.',
           'sound', null,
           'channelId', 'sahar-avisos',
           'data', jsonb_build_object('test', true)
         ))
    into messages
    from public.push_tokens t
   where t.user_id = uid
     and t.token like 'Expo%PushToken[%]'
   limit 10;

  if messages is null then return false; end if;

  begin
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := messages,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  exception
    when others then return false;
  end;
  return true;
end;
$$;

grant execute on function public.push_test() to authenticated;
