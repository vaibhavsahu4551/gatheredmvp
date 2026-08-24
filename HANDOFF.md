# Gathr — Project Handoff Guide

This document describes everything a developer needs to take over, maintain, or migrate the **Gathr** project away from Lovable. It is written for an engineer who has *no* prior context.

Read this top-to-bottom. Sections are ordered by what you'll touch first.

---

## 1. What Gathr is

Gathr is a mobile-first PWA (and Capacitor-wrapped native app) for planning small in-person group activities — gaming, coffee, dinner, movies, treks, etc. Core surfaces:

- **Auth** — Supabase Auth (email + password, Google OAuth, phone via Firebase) with an 18+ age gate and a 12-step onboarding wizard.
- **Events** — Verified-users-only creation with map-pinned locations, venue-type flags (public/private residence), group-size limits (4–10), event-type badges, status (Open / Filling up / Closed), early-close with attendee notification, and zero-attendee auto-sweep.
- **Feed** — Photo + caption posts with likes, comments, event linking. Nearby-only, own posts hidden.
- **Huddle/Linkup** — 1:1 connection requests → mutual DMs + share-to-chat.
- **Stories** — 24h stories with viewer lists, event tagging, background music.
- **Circles** — Persistent small groups with their own chat and quick event invites.
- **Pride** — Isolated LGBTQ+ section (separate identity, separate stories, separate interests) with strict RLS isolation. **Admin and main-app code must never read Pride data.**
- **Verification** — Live selfie matching against profile photo, admin review queue, blue "Verified" badge.
- **Premium** — ₹199/month subscription via Razorpay, with tiered entitlements.
- **Push** — Web FCM (browser) + native FCM/APNs (Capacitor Android/iOS) through the same `push_tokens` table.
- **Admin panel** — `/admin` dashboard for users, events, posts, stories, verification, revenue, badges, referrals, music, flagged content, engagement, and app settings.

---

## 2. Tech stack

| Layer | Tech |
|---|---|
| Framework | TanStack Start v1 (React 19, full-stack) on Vite 7 |
| Styling | Tailwind CSS v4 (via `src/styles.css`, native `@import`/`@theme`) |
| Backend | Lovable Cloud — managed Supabase (Postgres, Auth, Storage, Realtime) |
| Auth | Supabase Auth (email+password, Google OAuth) + Firebase Phone Auth (OTP / forgot-password) |
| Payments | Razorpay (subscriptions) |
| Push | Firebase Cloud Messaging (web + native), Apple APNs (iOS) |
| Maps | Leaflet + OpenStreetMap tiles (no API key) |
| Native shell | Capacitor (`android/` platform, `capacitor.config.ts`) |
| PWA | `public/manifest.webmanifest` |

**Do NOT swap in React Router, Next.js, Remix, or another framework.** The router is fixed to TanStack Router. Do not add `src/pages`, `App.tsx`, or legacy entry files.

---

## 3. Repository & code access

The project lives in a Lovable-managed git repo. To get the code:

1. **Connect a GitHub repo** (Workspace Settings → GitHub) and push, OR
2. Use Lovable's built-in version control to export a snapshot.

Either way, the developer needs:

- **Full Lovable workspace access** (or a project transfer) to edit code and run the preview/dev server. This is the *only* path to backend changes (migrations, RLS, storage, auth config) — see §4.
- A local clone of the repo for editing, with `bun install` (bun is the package manager used here).
- Node 18+ and bun for local dev.

### Local dev

```bash
bun install
bun run dev        # Vite dev server (default :8080 in this sandbox)
bun run build      # production build → dist/client
bun run typecheck  # tsgo typecheck
```

> Note: server functions run on a Cloudflare Worker (edge) runtime in production. `dev` runs on Node and does **not** enforce Worker constraints — always validate against a production build. `child_process`, `sharp`, `fs.watch`, and Node-only native addons are **not** available at runtime. See the `<server-runtime>` guidance in the codebase.

---

## 4. Backend access — the important constraint

**This project's backend is Lovable Cloud (managed Supabase). There is no separate Supabase dashboard login, and the service role key + database password are NOT retrievable.**

- **Direct Supabase dashboard access: not available.** You cannot log into supabase.com to run SQL, manage auth providers, or browse the DB directly.
- **Eject/export to a standalone Supabase project: not supported** by Lovable. To leave Lovable, you must create a fresh Supabase project, replay the migrations (67 of them, in `supabase/migrations/`), reconfigure auth providers, re-upload storage buckets, and re-point the app's `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` env vars. That's a real migration project, not an export button.
- **All backend work happens through Lovable**: SQL migrations, RLS policies, storage buckets, auth config, cron jobs, edge-function deploys. The developer must have Lovable access to do any of this.

### Project reference (internal, non-secret)

- **Supabase project ref:** `meyvcshgqbnzcizknmwf` (internal API use only — do not share in user-facing copy)
- **Anon/publishable key:** present in `.env` as `VITE_SUPABASE_PUBLISHABLE_KEY` (safe for client code; already in the repo)
- **Service role key & DB password:** not retrievable on Lovable Cloud — do not attempt to fabricate or expose them.

### Client connection

```ts
import { supabase } from "@/integrations/supabase/client";
```
Browser/RLS path. Never edit `src/integrations/supabase/client.ts` — it's auto-generated.

```ts
import { supabaseAdmin } from "@/integrations/supabase/client.server";
```
Privileged (bypasses RLS). Import dynamically **inside a handler** after verifying the caller; never use it for ordinary reads or to decide admin status.

### Migrations

There are **67 migration files** in `supabase/migrations/`. The schema covers: `profiles`, `events`, `event_participants`, `posts`, `post_likes`, `post_comments`, `chat_groups`, `chat_messages`, `dm_threads`, `dm_messages`, `huddle_requests`, `notifications`, `circles`, `circle_members`, `stories`, `story_views`, `verification_status`, `user_roles`, `app_settings`, `subscriptions`, `push_tokens`, `voice-notes` bucket, `pride_profiles`, `reports`, `blocks`, `event_comments`, `points_transactions`, `user_badges`, `badge_catalog`, `suggestion_dismissals`, `icebreaker_prompts`, `weekly_challenges`, `music_tracks`, `support_tickets`, `user_settings`, plus a `private` schema of RLS helper functions.

RLS is enabled on **every** table. Any new table must follow the `CREATE TABLE → GRANT → ENABLE RLS → CREATE POLICY` order (see `<public-schema-grants>` in the codebase).

---

## 5. Third-party accounts to transfer

These accounts must be handed over with the project. Each has its own console the new owner must control.

| Service | Used for | Where keys live | Console |
|---|---|---|---|
| **Firebase** (`huddl-502714`) | Phone Auth (signup OTP, forgot-password OTP), FCM push (web + native), Google OAuth | `FIREBASE_*` secrets + `android/app/google-services.json` | console.firebase.google.com |
| **Google Cloud** | reCAPTCHA (phone auth), Google OAuth client, Maps optional | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_API_KEY` | console.cloud.google.com |
| **Razorpay** | Premium subscriptions (₹199/mo) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_ID`, `RAZORPAY_WEBHOOK_SECRET` | dashboard.razorpay.com |
| **Lovable** | Code editor, preview, backend (managed Supabase), deploys, secrets store | `LOVABLE_API_KEY` (managed) | lovable.app |
| **Apple Developer** (if shipping iOS) | App Store, APNs, Sign in with Apple | `GoogleService-Info.plist` (native) + APNs key in Firebase | developer.apple.com |

> **Firebase is load-bearing for auth.** Phone OTP (signup + forgot-password) and native push both depend on it. The Firebase project ID is `huddl-502714`; transfer ownership of that Firebase project (Firebase → Project Settings → Users and permissions → add the new owner) before severing ties with the original owner.

> **Authorized domains** in Firebase Auth must include every domain that serves the app (preview, published, custom) plus `localhost`, or phone OTP silently fails at the reCAPTCHA step. This is the #1 gotcha when moving environments.

---

## 6. Secrets stored in the backend

Secrets are managed via Lovable (Workspace/Project → Secrets) and injected as `process.env.*` at runtime inside server functions and webhook handlers. **They are encrypted at rest and never displayed back.** The developer must re-add each one if migrating to a standalone setup.

Currently configured (12):

| Secret | Purpose |
|---|---|
| `FIREBASE_API_KEY` | Firebase web config |
| `FIREBASE_AUTH_DOMAIN` | Firebase web config |
| `FIREBASE_PROJECT_ID` | `huddl-502714` |
| `FIREBASE_STORAGE_BUCKET` | Firebase storage |
| `FIREBASE_MESSAGING_SENDER_ID` | FCM sender |
| `FIREBASE_APP_ID` | Firebase app ID |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Server-side FCM send (native + web push) — **full service account JSON, most sensitive** |
| `FIREBASE_VAVID_KEY` | Firebase Android app config |
| `GOOGLE_API_KEY` | Google services / Maps optional |
| `GOOGLE_OAUTH_CLIENT_ID` | Google Sign-In OAuth client |
| `PUSH_HOOK_SECRET` | Authenticates the internal `/api/public/send-push` trigger |
| `LOVABLE_API_KEY` | Lovable AI Gateway (managed; rotate via Lovable, not secrets tools) |

**Additionally referenced in code but NOT currently in the secrets store — must be added:**

| Secret | Purpose | File |
|---|---|---|
| `RAZORPAY_KEY_ID` | Razorpay checkout + order creation | `src/lib/razorpay.functions.ts` |
| `RAZORPAY_KEY_SECRET` | Razorpay server-side calls | `src/lib/razorpay.functions.ts` |
| `RAZORPAY_PLAN_ID` | The ₹199/month subscription plan | `src/lib/razorpay.functions.ts` |
| `RAZORPAY_WEBHOOK_SECRET` | Verifies Razorpay webhook signature | `src/routes/api/public/razorpay-webhook.ts` |

> If Razorpay features are currently erroring in production, it's because those 4 keys are missing — add them in Lovable → Secrets.

### `.env` (client-safe, in repo)

```
SUPABASE_PROJECT_ID
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```
These are safe for the client bundle. Never put service-role keys or `RAZORPAY_KEY_SECRET` here.

### Native build secrets

`android/app/google-services.json` is committed. For iOS, the developer must add `GoogleService-Info.plist` and register an APNs key in Firebase. Add the debug-keystore SHA-1/SHA-256 to the Firebase Android app for Google Sign-In to work natively.

---

## 7. Admin panel access

There is **no separate admin credential system.** Admin auth reuses the normal app auth, gated by a role row in the database.

### How it works

1. A user signs up normally via `/auth` (email+password, Google, or phone).
2. Their `auth.users` row gets a `profiles` row (auto-created by trigger).
3. An existing admin grants them the admin role by inserting a row:
   ```sql
   insert into public.user_roles (user_id, role) values ('<user-uuid>', 'admin');
   ```
4. They sign in at **`/admin-login`** (email + password), which:
   - calls `supabase.auth.signInWithPassword`
   - calls `isCurrentUserAdmin()` (in `src/lib/admin.ts`) → queries `user_roles` for `role = 'admin'` on their user id
   - if not admin, signs them out and rejects
   - if admin, redirects to `/admin`
5. The admin panel is a layout route (`src/routes/admin.tsx`) with sub-routes: `admin.index`, `admin.users`, `admin.events`, `admin.posts`, `admin.stories`, `admin.verification`, `admin.revenue`, `admin.badges`, `admin.rewards`, `admin.referrals`, `admin.music`, `admin.flagged`, `admin.engagement`, `admin.reports`, `admin.settings`.

### Granting admin access to a new developer

Because there's no Supabase dashboard, the only way to add an admin is via a migration run through Lovable (or an existing admin using the panel's user management if it supports role assignment). The developer needs:

- The user's email (they must have signed up at least once so a `profiles` + `auth.users` row exists).
- Lovable access to run the `insert into user_roles` SQL.

> **Pride data isolation in admin:** Admin queries deliberately exclude Pride (`pride_profiles`, Pride-flagged events, Pride stories). Never "fix" an admin query by broadening it to include Pride data without explicit instruction — that would break the privacy guarantee.

### Roles table schema (for reference)

```sql
create type public.app_role as enum ('admin', 'moderator', 'user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
```
Role checks use a `SECURITY DEFINER` `has_role()` function to avoid RLS recursion.

---

## 8. Build & deploy

### Web (PWA)
- Lovable handles preview + published deploys automatically on each change.
- Published URL: `https://gatheredmvp.lovable.app`
- Preview URL: `https://id-preview--ce839c12-d248-4974-aa6d-41389271320c.lovable.app`
- Production build: `bun run build` → `dist/client`.

### Native (Capacitor)
Documented in `NATIVE_PUSH.md`. Summary:

```bash
bun run build
npx cap sync android
npx cap open android      # opens Android Studio
```
Before first build:
- Drop the real `google-services.json` into `android/app/` (already present).
- Add your debug keystore SHA-1/SHA-256 to the Firebase Android app (Google Sign-In).
- Android 13+ will prompt for notification permission on launch — the app requests it via the Capacitor push plugin.

`capacitor.config.ts` points the native shell at the published URL (`https://gatheredmvp.lovable.app`), so the native app is a thin wrapper around the hosted build. If you migrate hosting off Lovable, update `server.url` there.

---

## 9. Pre-handoff checklist

Before transferring ownership, ensure the new developer has:

- [ ] **Lovable access** (workspace invite or project transfer) — required for any backend change.
- [ ] **Repo access** — connect GitHub and push, or export the snapshot.
- [ ] **Firebase project `huddl-502714` ownership transferred** (Users and permissions → add new owner).
- [ ] **Razorpay account access** + the 4 `RAZORPAY_*` secrets re-added if migrating.
- [ ] **Google Cloud project access** (OAuth client, reCAPTCHA, API keys).
- [ ] **Apple Developer account** (if shipping iOS): APNs key + `GoogleService-Info.plist`.
- [ ] All 12 backend secrets documented and re-creatable in the new environment (see §6).
- [ ] `.env` client vars updated to the new Supabase project if migrating off Lovable Cloud.
- [ ] **Firebase Authorized domains** updated to include every new serving domain + `localhost`.
- [ ] 67 migrations replayed on the new Supabase project (if migrating).
- [ ] Storage buckets recreated (`profile-photos`, `selfies`, `voice-notes`, story assets).
- [ ] `pg_cron` jobs rescheduled on the new project (story cleanup, empty-event sweep, icebreaker/challenge rotation).
- [ ] An existing admin account created on the new project, or a plan to insert the first `user_roles` admin row.
- [ ] `capacitor.config.ts` `server.url` repointed if hosting moves.

---

## 10. Critical invariants (do not break)

These are baked into the app's trust model. Violating them is a security/privacy incident, not a bug.

1. **Pride isolation.** Pride profiles, Pride stories, Pride-flagged events, and Pride interests are RLS-isolated and must never surface in the main feed, main stories rail, admin panels, or suggestion engine. Never broaden a query to "include Pride" without explicit instruction.
2. **Verified-users-only event creation & joining.** The live-selfie verification flow gates these. Do not weaken the gate.
3. **RLS on every table.** No new table without `GRANT` + `ENABLE ROW LEVEL SECURITY` + policies. A table with no policies is locked, not open.
4. **Service role key is unretrievable on Lovable Cloud.** Never instruct anyone to "get the service role key" — it doesn't exist in retrievable form. Privileged work goes through Lovable or a migrated standalone project.
5. **Admin role is in `user_roles`, never on the profile row.** Checking admin via client-side storage or a hardcoded flag is a privilege-escalation bug.
6. **Map privacy.** Public event views show an *approximate* pin (rounded coords). Exact coordinates are revealed only to approved attendees. Do not expose exact coords to non-members.
7. **Phone OTP requires Firebase Authorized domains.** Every serving domain must be allow-listed or OTP silently fails.

---

*Last updated: Aug 2026. If the project migrates off Lovable Cloud, update §4–§6 to reflect the new backend and secret locations.*
