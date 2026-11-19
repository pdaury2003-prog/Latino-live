-- Seven digit numbers must not reveal how many people have joined, so each one
-- is drawn at random instead of counting up from the first account.

create or replace function public.next_user_number()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate integer;
  tries integer := 0;
begin
  loop
    candidate := 1000000 + floor(random() * 9000000)::integer;
    exit when not exists (select 1 from public.profiles where user_number = candidate);
    tries := tries + 1;
    if tries > 500 then
      raise exception 'No hay numeros libres';
    end if;
  end loop;
  return candidate;
end;
$$;

do $$
declare row_id uuid;
begin
  for row_id in select id from public.profiles order by created_at loop
    update public.profiles set user_number = public.next_user_number() where id = row_id;
  end loop;
end $$;

drop sequence if exists public.profile_number_seq;
