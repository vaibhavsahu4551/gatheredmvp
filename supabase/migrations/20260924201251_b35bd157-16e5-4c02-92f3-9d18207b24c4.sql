CREATE OR REPLACE FUNCTION private.can_read_feed_photo(
  _object_name text,
  _object_owner text,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT _user_id IS NOT NULL
    AND (
      _object_owner = _user_id::text
      OR split_part(_object_name, '/', 1) = _user_id::text
      OR EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.photo_url = _object_name
      )
    );
$$;

CREATE OR REPLACE FUNCTION private.can_read_event_photo(
  _object_name text,
  _object_owner text,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT _user_id IS NOT NULL
    AND (
      _object_owner = _user_id::text
      OR split_part(_object_name, '/', 1) = _user_id::text
      OR EXISTS (
        SELECT 1
        FROM public.events e
        WHERE e.cover_url = _object_name
          AND (e.is_pride = false OR private.has_pride_access(_user_id))
          AND (e.cohost_status <> 'pending' OR e.host_id = _user_id OR e.cohost_id = _user_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.official_events e
        WHERE e.published = true
          AND _object_name IN (e.cover_url, e.organizer_logo, e.ticket_bg_url)
      )
      OR EXISTS (
        SELECT 1
        FROM public.circles c
        JOIN public.circle_members cm ON cm.circle_id = c.id
        WHERE c.photo_path = _object_name
          AND cm.user_id = _user_id
      )
    );
$$;

CREATE OR REPLACE FUNCTION private.can_read_active_music(
  _object_name text,
  _object_owner text,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT _user_id IS NOT NULL
    AND (
      _object_owner = _user_id::text
      OR EXISTS (
        SELECT 1
        FROM public.music_tracks t
        WHERE t.active = true
          AND (t.storage_path = _object_name OR t.url = _object_name)
      )
    );
$$;

REVOKE ALL ON FUNCTION private.can_read_feed_photo(text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_read_event_photo(text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_read_active_music(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_read_feed_photo(text, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_read_event_photo(text, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_read_active_music(text, text, uuid) TO authenticated, service_role;

DROP POLICY "Members read visible feed photos" ON storage.objects;
CREATE POLICY "Members read visible feed photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'feed-photos'
  AND private.can_read_feed_photo(name, owner_id, auth.uid())
);

DROP POLICY "Members read visible event photos" ON storage.objects;
CREATE POLICY "Members read visible event photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'event-photos'
  AND private.can_read_event_photo(name, owner_id, auth.uid())
);

DROP POLICY "Members read active music" ON storage.objects;
CREATE POLICY "Members read active music"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'music'
  AND private.can_read_active_music(name, owner_id, auth.uid())
);