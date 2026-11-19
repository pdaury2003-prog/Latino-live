-- Every new account starts with 500.000 diamonds: enough to try the shop,
-- the frames and the gifts from the first minute.

alter table public.profiles alter column diamonds set default 500000;

-- Accounts created earlier keep at least the same starting wallet; anyone who
-- already had more keeps their balance untouched.
update public.profiles set diamonds = 500000 where coalesce(diamonds, 0) < 500000;
