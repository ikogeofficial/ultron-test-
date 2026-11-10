-- Ikoge Ultron reminders: run this once in Supabase > SQL Editor.
-- Before running, change the two words in CAPITALS in the last block.

create table if not exists ul_keys (id int primary key, priv jsonb not null, pub text not null);
create table if not exists ul_push (
  uid text primary key, th text not null, endpoint text not null, is_on boolean not null default true,
  items jsonb not null default '{}', done jsonb not null default '{}', done_date text default '',
  fired jsonb not null default '{}', fired_date text default ''
);
create table if not exists ul_msg (uid text primary key, msgs jsonb not null, created timestamptz not null default now());

-- lock the tables: only the Edge Function (service role) can touch them
alter table ul_keys enable row level security;
alter table ul_push enable row level security;
alter table ul_msg enable row level security;

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- every minute, wake the function. Replace YOURREF (the part before .supabase.co) and YOURSECRET (any long random text,
-- and use the SAME text as the CRON_SECRET secret on the function).
select cron.schedule('ul-reminders', '* * * * *', $$
  select net.http_post(
    url := 'https://YOURREF.supabase.co/functions/v1/reminders/cron',
    headers := '{"x-cron-secret":"YOURSECRET"}'::jsonb
  )
$$);
