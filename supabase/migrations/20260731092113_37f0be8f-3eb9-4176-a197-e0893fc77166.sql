create extension if not exists pg_net;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.push_tokens to authenticated;
grant all on public.push_tokens to service_role;

alter table public.push_tokens enable row level security;

create policy "own tokens select" on public.push_tokens for select to authenticated using (user_id = auth.uid());
create policy "own tokens insert" on public.push_tokens for insert to authenticated with check (user_id = auth.uid());
create policy "own tokens update" on public.push_tokens for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own tokens delete" on public.push_tokens for delete to authenticated using (user_id = auth.uid());

create trigger push_tokens_touch before update on public.push_tokens
  for each row execute function public.touch_updated_at();

create table if not exists private.push_config (
  id int primary key default 1,
  endpoint text not null,
  secret text not null
);

insert into private.push_config (id, endpoint, secret)
values (1, 'https://project--ce839c12-d248-4974-aa6d-41389271320c.lovable.app/api/public/send-push', 'not-set')
on conflict (id) do nothing;

create or replace function private.dispatch_push(_user uuid, _title text, _body text, _url text)
returns void
language plpgsql
security definer
set search_path = private, public
as $$
declare cfg record;
begin
  select * into cfg from private.push_config where id = 1;
  if cfg is null then return; end if;
  perform net.http_post(
    url := cfg.endpoint,
    headers := jsonb_build_object('Content-Type','application/json','x-push-secret', cfg.secret),
    body := jsonb_build_object('user_id', _user, 'title', _title, 'body', _body, 'url', _url)
  );
exception when others then
  return;
end $$;

create or replace function private.actor_name(_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$ select coalesce(nullif(full_name,''), 'Someone') from public.profiles where id = _user $$;

create or replace function public.notification_push()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare who text; t text; b text; u text;
begin
  if NEW.is_pride then return NEW; end if;
  who := coalesce(private.actor_name(NEW.actor_id), 'Someone');
  if NEW.kind = 'post_like' then
    t := 'New like'; b := who || ' liked your post'; u := '/posts/' || NEW.target_id;
  elsif NEW.kind = 'post_comment' then
    t := 'New comment'; b := who || ' commented on your post'; u := '/posts/' || NEW.target_id;
  elsif NEW.kind = 'huddle_request' then
    t := 'New Linkup request'; b := who || ' wants to Linkup with you'; u := '/requests';
  elsif NEW.kind = 'huddle_accepted' then
    t := 'Linkup accepted'; b := who || ' accepted your Linkup request'; u := '/requests';
  elsif NEW.kind = 'join_request' then
    t := 'New join request'; b := who || ' asked to join your Gathr'; u := '/events/' || NEW.target_id;
  elsif NEW.kind = 'join_approved' then
    t := 'You''re in!'; b := 'Your request to join was approved'; u := '/events/' || NEW.target_id;
  elsif NEW.kind = 'join_declined' then
    t := 'Request declined'; b := 'Your request to join was declined'; u := '/events/' || NEW.target_id;
  else
    t := 'Gathr'; b := 'You have a new notification'; u := '/notifications';
  end if;
  perform private.dispatch_push(NEW.user_id, t, b, u);
  return NEW;
end $$;

drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push after insert on public.notifications
  for each row execute function public.notification_push();

create or replace function public.dm_message_push()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare recipient uuid; who text; preview text;
begin
  select case when user_a = NEW.sender_id then user_b else user_a end
    into recipient from public.dm_threads where id = NEW.thread_id;
  if recipient is null or recipient = NEW.sender_id then return NEW; end if;
  if not private.notif_allowed(recipient, 'message') then return NEW; end if;
  who := coalesce(private.actor_name(NEW.sender_id), 'Someone');
  preview := coalesce(nullif(NEW.body, ''), case when NEW.voice_url is not null then 'Sent a voice note' else 'Sent you a message' end);
  if length(preview) > 90 then preview := left(preview, 90) || '…'; end if;
  perform private.dispatch_push(recipient, who, preview, '/messages/' || NEW.thread_id);
  return NEW;
end $$;

drop trigger if exists dm_messages_push on public.dm_messages;
create trigger dm_messages_push after insert on public.dm_messages
  for each row execute function public.dm_message_push();