## HUDDL Phase 2 — Events, Feed & Chat

Building on the existing verified-user gate, I'll add event creation, discovery, join workflow, a nearby feed, and realtime group chat.

### 1. Database (single migration)

New tables (all with RLS + GRANTs, timestamps, update triggers):

- **events** — `host_id`, `title`, `description`, `category` (enum), `starts_at`, `location_address`, `location_lat/lng` (nullable), `min_size` (>=4), `max_size`, `entry_fee` (nullable), `min_girls`, `min_boys` (nullable), `city`, `status` (enum: `pending`/`confirmed`/`cancelled`/`completed`), `auto_cancel_hours` (default 2).
- **event_participants** — `event_id`, `user_id`, `status` (`pending`/`approved`/`rejected`), `gender` snapshot for ratio counting.
- **posts** — `user_id`, `city`, `photo_url`, `caption`.
- **post_likes** — `post_id`, `user_id` (unique).
- **post_comments** — `post_id`, `user_id`, `body`.
- **chat_groups** — `event_id` (unique, created when event confirmed).
- **chat_messages** — `group_id`, `user_id`, `body`.

Enums: `event_category`, `event_status`, `participant_status`.

**Enforcement**
- CHECK: `min_size >= 4`, `max_size >= min_size`.
- Trigger: when approved participants ≥ `min_size`, flip `events.status` to `confirmed` and insert `chat_groups` row.
- Cron (pg_cron, hourly): if `starts_at - now() <= auto_cancel_hours` and status still `pending`, set `cancelled`.
- `handle_new_event_participant` trigger blocks join if user not verified.

**RLS highlights**
- events: SELECT for authenticated; INSERT only if `has_verified(auth.uid())`; UPDATE/DELETE only host.
- event_participants: SELECT own + host of event; INSERT self (verified); UPDATE only host (approve/reject) or self (cancel).
- posts: SELECT for authenticated (filtered client-side by city); INSERT only verified; UPDATE/DELETE own.
- post_likes/comments: standard own-row rules, SELECT open to authenticated.
- chat_groups/chat_messages: SELECT/INSERT only for approved participants of the event (security-definer helper `is_event_member`).

Enable Realtime on `chat_messages`, `event_participants`.

### 2. Frontend routes

Under `src/routes/_authenticated/_app/`:

- `create.tsx` — full form (rewrite the placeholder). Category select, datetime, address input, min/max sliders (min ≥ 4), optional entry fee, optional gender ratio, residential warning if address matches heuristic (contains "apartment"/"flat"/"villa"/"house"/"road no"/"block"), submit → insert event.
- `home.tsx` — replace mock with live query: events in user's city, sorted by `starts_at`. Filters (category chips, date range popover, "girls preferred" toggle) and search input. Each card: title/date/location/category, "X boys, Y girls joined / max N", host name + verified badge, Join button.
- `events/$eventId.tsx` — event detail: description, participants, Request to Join button, if host → pending requests list with approve/reject, status banner ("waiting for more people" / "confirmed").
- `events.tsx` — split into "Hosting" and "Joined" tabs listing user's events.
- `chat.tsx` — list of confirmed event group chats user belongs to.
- `chat/$groupId.tsx` — realtime message thread; subscribe via `supabase.channel` inside `useEffect`.
- `feed.tsx` (new bottom-nav tab replacing… actually keep 5 tabs — repurpose Home to include feed section OR add feed under Home). **Decision:** add a segmented toggle on Home between "Events" and "Feed" to preserve 5-tab nav.

### 3. Helpers

`src/lib/events.ts` — typed fetchers (list events by city, get event with participants, join/approve/reject, participant counts by gender).
`src/lib/feed.ts` — posts CRUD + likes/comments.
`src/lib/chat.ts` — list groups, send message, subscribe.

### Technical notes

- Realtime subscription tears down in effect cleanup.
- Participant counts computed via SQL view `event_counts` (approved counts by gender) to avoid N+1.
- Auto-confirm & auto-cancel handled in DB (trigger + pg_cron), so no server function needed.
- Chat access enforced by RLS using `is_event_member(auth.uid(), group_id)` security-definer.
- All new tables get `authenticated` GRANTs + `service_role` ALL; no `anon`.

### Out of scope (Phase 2)

- Real map picker (using address text + optional lat/lng manually; can add Mapbox later).
- Push notifications for auto-cancel (DB flag only; users see status on next open).
- Image upload for feed posts uses existing `profile-photos` bucket pattern with a new `feed-photos` private bucket + signed URLs.

Shall I proceed?
