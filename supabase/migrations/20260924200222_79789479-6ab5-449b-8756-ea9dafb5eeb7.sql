ALTER TABLE public.official_event_organiser_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_event_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_event_application_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage organiser tokens"
ON public.official_event_organiser_tokens
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Applicants and admins view official applications"
ON public.official_event_applications
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Members submit own official applications"
ON public.official_event_applications
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND accepted_at IS NULL
  AND payment_deadline_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.official_events e
    WHERE e.id = event_id AND e.published = true AND e.booking_type = 'selection'
  )
);

CREATE POLICY "Admins update official applications"
ON public.official_event_applications
FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete official applications"
ON public.official_event_applications
FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Published official event questions are readable"
ON public.official_event_application_questions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.official_events e
    WHERE e.id = event_id AND e.published = true
  )
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins manage official event questions"
ON public.official_event_application_questions
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY "Signed-in members read badges" ON public.badge_catalog;
CREATE POLICY "Signed-in members read active badges"
ON public.badge_catalog FOR SELECT TO authenticated
USING (active = true);

DROP POLICY "assignments readable" ON public.weekly_challenge_assignments;
CREATE POLICY "Current challenge assignments readable"
ON public.weekly_challenge_assignments FOR SELECT TO authenticated
USING (
  week_start <= current_date
  AND week_start >= current_date - 7
  AND EXISTS (
    SELECT 1 FROM public.weekly_challenges c
    WHERE c.id = challenge_id AND c.active = true
  )
);

DROP POLICY "daily readable" ON public.daily_icebreakers;
CREATE POLICY "Current icebreakers readable"
ON public.daily_icebreakers FOR SELECT TO authenticated
USING (
  day <= current_date
  AND day >= current_date - 7
  AND EXISTS (
    SELECT 1 FROM public.icebreaker_prompts p
    WHERE p.id = prompt_id AND p.active = true
  )
);

DROP POLICY "Authenticated read active tracks" ON public.music_tracks;
CREATE POLICY "Authenticated read active tracks"
ON public.music_tracks FOR SELECT TO authenticated
USING (active = true);

DROP POLICY "Public can view participant counts" ON public.event_participants;
CREATE POLICY "Public views approved participants for public events"
ON public.event_participants FOR SELECT TO anon
USING (
  status = 'approved'::public.participant_status
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id
      AND e.is_pride = false
      AND e.cohost_status <> 'pending'
  )
);

DROP POLICY "badges readable" ON public.user_badges;
CREATE POLICY "Visible profile badges readable"
ON public.user_badges FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_id
      AND p.onboarding_complete = true
      AND (p.suspended_until IS NULL OR p.suspended_until <= now())
      AND p.pride_opt_in = false
  )
);

DROP POLICY "Authenticated can view profiles" ON public.profiles;
CREATE POLICY "Members view eligible profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    onboarding_complete = true
    AND (suspended_until IS NULL OR suspended_until <= now())
    AND pride_opt_in = false
  )
);

DROP POLICY "Everyone reads banners" ON public.home_banners;
CREATE POLICY "Everyone reads active banners"
ON public.home_banners FOR SELECT TO anon, authenticated
USING (
  active = true
  AND starts_at <= now()
  AND (ends_at IS NULL OR ends_at > now())
);

DROP POLICY "Public can view events" ON public.events;
CREATE POLICY "Public can view non-pride events"
ON public.events FOR SELECT TO anon
USING (is_pride = false AND cohost_status <> 'pending');

DROP POLICY "Anyone can read platform fee settings" ON public.platform_fee_settings;
CREATE POLICY "Anyone reads valid platform fee settings"
ON public.platform_fee_settings FOR SELECT TO anon, authenticated
USING (
  fee_type IN ('percentage', 'fixed')
  AND fee_value >= 0
);

DROP POLICY "rewards config readable" ON public.rewards_config;
CREATE POLICY "Members read active rewards config"
ON public.rewards_config FOR SELECT TO authenticated
USING (id = 1);

DROP POLICY "Authenticated reads settings" ON public.app_settings;
CREATE POLICY "Authenticated reads app settings"
ON public.app_settings FOR SELECT TO authenticated
USING (id = 1);

DROP POLICY "Authenticated can read voice notes" ON storage.objects;
CREATE POLICY "Participants read linked voice notes"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.dm_messages m
      JOIN public.dm_threads t ON t.id = m.thread_id
      WHERE m.voice_url = name AND (t.user_a = auth.uid() OR t.user_b = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.chat_messages m
      WHERE m.voice_url = name AND private.is_group_member(m.group_id, auth.uid())
    )
  )
);

DROP POLICY "Signed-in members can read story media" ON storage.objects;
CREATE POLICY "Members read visible story media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'stories'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.media_path = name
        AND s.expires_at > now()
        AND (s.is_pride = false OR private.has_pride_access(auth.uid()))
    )
  )
);

DROP POLICY "Anyone authenticated can view feed photos" ON storage.objects;
CREATE POLICY "Members read visible feed photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'feed-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.photo_url = name
    )
  )
);

DROP POLICY "event photos readable by signed-in" ON storage.objects;
CREATE POLICY "Members read visible event photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'event-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.cover_url = name
        AND (e.is_pride = false OR private.has_pride_access(auth.uid()))
        AND (e.cohost_status <> 'pending' OR e.host_id = auth.uid() OR e.cohost_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.official_events e
      WHERE e.published = true
        AND name IN (e.cover_url, e.organizer_logo, e.ticket_bg_url)
    )
    OR EXISTS (
      SELECT 1 FROM public.circles c
      JOIN public.circle_members cm ON cm.circle_id = c.id
      WHERE c.photo_path = name AND cm.user_id = auth.uid()
    )
  )
);

DROP POLICY "Anyone authenticated can view profile photos" ON storage.objects;
CREATE POLICY "Members read eligible profile photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.onboarding_complete = true
        AND (p.suspended_until IS NULL OR p.suspended_until <= now())
        AND p.pride_opt_in = false
    )
  )
);

DROP POLICY "Authenticated read music" ON storage.objects;
CREATE POLICY "Members read active music"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'music'
  AND EXISTS (
    SELECT 1 FROM public.music_tracks t
    WHERE t.active = true
      AND (t.storage_path = name OR t.url = name)
  )
);