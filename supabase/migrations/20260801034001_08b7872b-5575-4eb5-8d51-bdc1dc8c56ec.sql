
CREATE OR REPLACE FUNCTION public.chat_message_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
declare ev uuid; ttl text; who text; preview text; r record;
begin
  select event_id into ev from public.chat_groups where id = NEW.group_id;
  if ev is null then return NEW; end if;
  select title into ttl from public.events where id = ev;
  who := coalesce(private.actor_name(NEW.user_id), 'Someone');
  preview := coalesce(nullif(NEW.body, ''), case when NEW.voice_url is not null then 'Sent a voice note' else 'Sent a message' end);
  if length(preview) > 90 then preview := left(preview, 90) || '…'; end if;
  for r in
    select distinct p.user_id from public.event_participants p
     where p.event_id = ev and p.status = 'approved' and p.user_id <> NEW.user_id
  loop
    if private.notif_allowed(r.user_id, 'message') then
      perform private.dispatch_push(r.user_id, coalesce(ttl, 'Group chat'), who || ': ' || preview, '/chat/' || NEW.group_id);
    end if;
  end loop;
  return NEW;
exception when others then
  return NEW;
end $$;

REVOKE ALL ON FUNCTION public.chat_message_push() FROM PUBLIC, anon, authenticated;
