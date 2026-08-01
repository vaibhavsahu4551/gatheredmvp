
-- respect the Messages toggle
CREATE OR REPLACE FUNCTION private.notif_allowed(_user uuid, _kind text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE((
    SELECT s.push_enabled AND CASE
      WHEN _kind = 'post_like' THEN s.notify_likes
      WHEN _kind = 'post_comment' THEN s.notify_comments
      WHEN _kind IN ('join_request','join_approved','join_declined') THEN s.notify_join_requests
      WHEN _kind IN ('huddle_request','huddle_accepted') THEN s.notify_linkups
      WHEN _kind = 'message' THEN s.notify_messages
      ELSE true
    END
    FROM public.user_settings s WHERE s.user_id = _user
  ), true);
$$;

-- push / notification triggers
DROP TRIGGER IF EXISTS trg_dm_message_push ON public.dm_messages;
CREATE TRIGGER trg_dm_message_push AFTER INSERT ON public.dm_messages
  FOR EACH ROW EXECUTE FUNCTION public.dm_message_push();

DROP TRIGGER IF EXISTS trg_notification_push ON public.notifications;
CREATE TRIGGER trg_notification_push AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notification_push();

DROP TRIGGER IF EXISTS trg_post_like_notify ON public.post_likes;
CREATE TRIGGER trg_post_like_notify AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.post_like_notify();

DROP TRIGGER IF EXISTS trg_post_comment_notify ON public.post_comments;
CREATE TRIGGER trg_post_comment_notify AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.post_comment_notify();

DROP TRIGGER IF EXISTS trg_huddle_request_notify ON public.huddle_requests;
CREATE TRIGGER trg_huddle_request_notify AFTER INSERT OR UPDATE ON public.huddle_requests
  FOR EACH ROW EXECUTE FUNCTION public.huddle_request_notify();

DROP TRIGGER IF EXISTS trg_event_participant_notify ON public.event_participants;
CREATE TRIGGER trg_event_participant_notify AFTER INSERT OR UPDATE ON public.event_participants
  FOR EACH ROW EXECUTE FUNCTION public.event_participant_notify();

-- group chat push
CREATE OR REPLACE FUNCTION public.chat_message_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
declare ev uuid; ttl text; who text; preview text; r record;
begin
  select event_id into ev from public.chat_groups where id = NEW.group_id;
  if ev is null then return NEW; end if;
  select title into ttl from public.events where id = ev;
  who := coalesce(private.actor_name(NEW.sender_id_placeholder), '');
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

DROP TRIGGER IF EXISTS trg_chat_message_push ON public.chat_messages;
CREATE TRIGGER trg_chat_message_push AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_message_push();

-- app-logic triggers that were also detached
DROP TRIGGER IF EXISTS trg_check_event_confirmation ON public.event_participants;
CREATE TRIGGER trg_check_event_confirmation AFTER INSERT OR UPDATE ON public.event_participants
  FOR EACH ROW EXECUTE FUNCTION public.check_event_confirmation();

DROP TRIGGER IF EXISTS trg_block_participant_insert ON public.event_participants;
CREATE TRIGGER trg_block_participant_insert BEFORE INSERT ON public.event_participants
  FOR EACH ROW EXECUTE FUNCTION public.block_participant_insert();

DROP TRIGGER IF EXISTS trg_fill_ep_pride_actor ON public.event_participants;
CREATE TRIGGER trg_fill_ep_pride_actor BEFORE INSERT ON public.event_participants
  FOR EACH ROW EXECUTE FUNCTION public.fill_ep_pride_actor();

DROP TRIGGER IF EXISTS trg_fill_ec_pride_actor ON public.event_comments;
CREATE TRIGGER trg_fill_ec_pride_actor BEFORE INSERT ON public.event_comments
  FOR EACH ROW EXECUTE FUNCTION public.fill_ec_pride_actor();

DROP TRIGGER IF EXISTS trg_fill_cm_pride_actor ON public.chat_messages;
CREATE TRIGGER trg_fill_cm_pride_actor BEFORE INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.fill_cm_pride_actor();

DROP TRIGGER IF EXISTS trg_fill_event_pride_actor ON public.events;
CREATE TRIGGER trg_fill_event_pride_actor BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.fill_event_pride_actor();

DROP TRIGGER IF EXISTS trg_auto_boost_new_event ON public.events;
CREATE TRIGGER trg_auto_boost_new_event BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.auto_boost_new_event();

DROP TRIGGER IF EXISTS trg_enforce_linkup_privacy ON public.huddle_requests;
CREATE TRIGGER trg_enforce_linkup_privacy BEFORE INSERT ON public.huddle_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_linkup_privacy();

DROP TRIGGER IF EXISTS trg_selfie_uploaded ON public.profiles;
CREATE TRIGGER trg_selfie_uploaded AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.selfie_uploaded();

DROP TRIGGER IF EXISTS trg_sync_premium_flags ON public.profiles;
CREATE TRIGGER trg_sync_premium_flags BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_premium_flags();

DROP TRIGGER IF EXISTS trg_profiles_touch ON public.profiles;
CREATE TRIGGER trg_profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_events_touch ON public.events;
CREATE TRIGGER trg_events_touch BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
