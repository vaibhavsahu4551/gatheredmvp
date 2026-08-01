# Meetup Hub

Build a mobile-first web app called "[HUDDL]" - a group-only event/meetup app 

where verified strangers plan activities together (gaming, coffee, dinner, movies, 

hangouts). Use React + Supabase.

Features for Phase 1:

1. AUTHENTICATION

- Phone number signup with OTP verification (Supabase Auth)

- Age gate: only 18+ allowed, ask date of birth, block under-18

- After OTP verify, redirect to profile setup (mandatory before app access)

2. PROFILE SETUP

- Name, age, gender, city/location

- Bio (short text, 150 chars)

- Interest tags (multi-select): Gaming, Coffee, Dinner, Movies, Trekking, 

  Evening Hangout, Sports, Party

- Multiple photo upload (min 2, max 6) to Supabase storage

- Selfie upload field (placeholder for KYC - mark status as "pending_review")

- Profile status field: unverified / pending / verified

- Users with status != "verified" cannot access feed or create/join events 

  (show a "verification pending" screen instead)

3. BASIC NAVIGATION

- Bottom nav: Home/Feed, Events, Create, Chat, Profile

- Clean card-based UI, mobile-first

Use Supabase tables: users, profiles, verification_status

Set up Row Level Security so users only edit their own profile.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://gatheredmvp.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ce839c12-d248-4974-aa6d-41389271320c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
