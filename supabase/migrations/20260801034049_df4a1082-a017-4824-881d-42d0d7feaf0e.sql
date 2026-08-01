
DROP TRIGGER IF EXISTS trg_dm_message_push ON public.dm_messages;
DROP TRIGGER IF EXISTS trg_notification_push ON public.notifications;
DROP TRIGGER IF EXISTS trg_event_participant_notify ON public.event_participants;
DROP TRIGGER IF EXISTS trg_block_participant_insert ON public.event_participants;
DROP TRIGGER IF EXISTS trg_fill_ep_pride_actor ON public.event_participants;
DROP TRIGGER IF EXISTS trg_fill_ec_pride_actor ON public.event_comments;
DROP TRIGGER IF EXISTS trg_fill_cm_pride_actor ON public.chat_messages;
DROP TRIGGER IF EXISTS trg_fill_event_pride_actor ON public.events;
DROP TRIGGER IF EXISTS trg_events_touch ON public.events;
DROP TRIGGER IF EXISTS trg_profiles_touch ON public.profiles;
DROP TRIGGER IF EXISTS trg_selfie_uploaded ON public.profiles;
DROP TRIGGER IF EXISTS trg_enforce_linkup_privacy ON public.huddle_requests;
DROP TRIGGER IF EXISTS trg_huddle_request_notify ON public.huddle_requests;
