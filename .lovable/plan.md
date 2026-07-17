# Firebase Phone Auth — Full Migration Plan

Replace Supabase Auth with Firebase Phone OTP. Firebase becomes the sole identity provider; Supabase remains the database but with a rewritten auth model.

## Important upfront warnings

1. **All existing users and data will be orphaned.** Current rows key off Supabase `auth.users(id)` UUIDs. Firebase UIDs are 28-char strings, not UUIDs. There is no safe automatic mapping — existing profiles, events, chats, and posts will no longer be reachable by their original owners. Since the app is pre-launch, I'll wipe user data as part of the migration.
2. **RLS model changes.** Supabase supports Firebase as a native third-party auth provider: Firebase-issued JWTs are validated by Supabase, and `auth.jwt() ->> 'sub'` returns the Firebase UID inside RLS. All policies will be rewritten to use the Firebase UID (text) instead of `auth.uid()` (uuid).
3. **Phone auth in dev.** Firebase requires reCAPTCHA (invisible) and a verified sending domain. The Lovable preview domain must be added to Firebase Auth's "Authorized domains" list by the user in Firebase Console before OTP will send. I'll add test-number instructions in the plan.

## Approach

### 1. Environment
- Move the 6 Firebase keys from server secrets into `.env` as `VITE_FIREBASE_*` (they are public web keys by design).
- Install `firebase` npm package.

### 2. Configure Supabase third-party auth for Firebase
Register Firebase as a JWT auth provider in `supabase/config.toml` (via the Supabase config tool) so Supabase validates Firebase ID tokens and populates `auth.jwt()` for RLS.

### 3. Database migration (single migration)
- Drop existing rows in: `chat_messages`, `chat_groups`, `event_participants`, `events`, `post_comments`, `post_likes`, `posts`, `verification_status`, `profiles`.
- Change every `user_id`/`host_id`/`author_id`/`id` column that referenced `auth.users(id)` from `uuid` to `text`.
- Drop FKs to `auth.users`. Firebase UID is the new identity — no local users table needed (profile row IS the user record, keyed by Firebase UID).
- Drop the `handle_new_user` trigger on `auth.users` (Supabase Auth won't be creating users anymore). Profile creation happens client-side after OTP verify.
- Rewrite every RLS policy: replace `auth.uid() = user_id` with `(auth.jwt() ->> 'sub') = user_id`. Rewrite the security-definer helpers (`is_event_host`, `is_event_member`, `is_group_member`, `is_verified`) to accept `text` and compare against the JWT sub.
- Rewrite storage bucket policies (`profile-photos`, `selfies`, `feed-photos`) so the first path segment must equal `auth.jwt() ->> 'sub'`.
- Re-run all GRANTs.

### 4. New Firebase client module
- `src/integrations/firebase/client.ts` — initializes the SDK from `VITE_FIREBASE_*`.
- `src/integrations/firebase/auth.ts` — helpers: `sendOtp(phone, recaptchaContainer)`, `verifyOtp(confirmationResult, code)`, `signOut()`, `onIdTokenChanged(cb)`.

### 5. Bridge Firebase → Supabase client
- Rewrite `src/integrations/supabase/client.ts` to attach the Firebase ID token as the `Authorization: Bearer <token>` header on every Supabase request (via a custom `fetch` wrapper), and refresh it on Firebase token changes. Publishable key stays as `apikey`.
- Remove all `supabase.auth.*` calls throughout the codebase (getSession, getUser, signOut, onAuthStateChange, signInWithOtp, verifyOtp).

### 6. Rewrite auth screen
- `src/routes/auth.tsx`: two-step phone → OTP flow using Firebase. Invisible reCAPTCHA container. On successful verify:
  - Query `profiles` by Firebase UID.
  - If none exists → insert stub row + redirect to `/onboarding`.
  - If exists and `onboarding_complete` → `/home`. Otherwise `/onboarding`.

### 7. Update every reference to the old session
- `src/routes/_authenticated/route.tsx` — gate on Firebase auth state, not Supabase session.
- `src/lib/huddl.ts` `loadMe()` — get current user from Firebase, query profile by Firebase UID.
- All lib files (`events.ts`, `feed.ts`, `chat.ts`) — replace `supabase.auth.getUser()` with Firebase UID getter.
- Sign-out button in profile → Firebase `signOut()`.

### 8. Age gate stays where it is (onboarding DOB check).

## Files touched

**New**
- `src/integrations/firebase/client.ts`
- `src/integrations/firebase/auth.ts`

**Rewritten**
- `.env` (add VITE_FIREBASE_*)
- `src/integrations/supabase/client.ts` (token attacher)
- `src/routes/auth.tsx` (phone + OTP)
- `src/routes/_authenticated/route.tsx` (Firebase gate)
- `src/lib/huddl.ts` (Firebase UID lookup)
- `src/lib/events.ts`, `src/lib/feed.ts`, `src/lib/chat.ts` (remove supabase.auth calls)
- `src/routes/_authenticated/_app/profile.tsx` (Firebase signOut)
- `src/routes/_authenticated/_app.tsx` (loadMe still works)

**Migration**
- One Supabase migration: wipe data, retype columns, rewrite policies + helpers, storage policies, drop `handle_new_user` trigger.

**Config**
- Register Firebase as third-party auth provider via `supabase--configure_auth` (or config.toml edit if needed).

## Manual steps you'll need to do

1. In **Firebase Console → Authentication → Sign-in method**: enable **Phone**.
2. In **Firebase Console → Authentication → Settings → Authorized domains**: add your Lovable preview domain (`id-preview--ce839c12-...lovable.app`) and published domain (`huddlmeet.lovable.app`).
3. Optional: add test phone numbers under **Phone numbers for testing** to avoid burning SMS quota during development.

## Risks

- If Firebase third-party auth registration on the Supabase side fails or isn't supported on your plan, all authenticated Supabase queries will 401 and the app will be non-functional until reverted. I'll verify the config tool accepts Firebase before rewriting policies.
- Realtime subscriptions (chat) rely on Supabase Auth session — with third-party JWT, the realtime client needs the Firebase token attached too. I'll wire that in the same client module.

Approve to proceed, or tell me what to change.
