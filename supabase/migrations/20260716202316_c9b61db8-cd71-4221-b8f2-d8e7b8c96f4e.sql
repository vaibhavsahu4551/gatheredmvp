
-- Enum for verification status
create type public.verification_state as enum ('unverified', 'pending', 'verified');

-- Profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  dob date,
  gender text,
  city text,
  bio text check (char_length(bio) <= 150),
  interests text[] not null default '{}',
  photos text[] not null default '{}',
  selfie_url text,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dob_18_plus check (dob is null or dob <= (current_date - interval '18 years'))
);

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

-- Authenticated users can view any profile (needed for feed later)
create policy "Authenticated can view profiles"
  on public.profiles for select to authenticated using (true);

create policy "Users insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users delete own profile"
  on public.profiles for delete to authenticated using (auth.uid() = id);

-- Verification status table (separate so users cannot self-verify)
create table public.verification_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status public.verification_state not null default 'unverified',
  notes text,
  updated_at timestamptz not null default now()
);

grant select on public.verification_status to authenticated;
grant all on public.verification_status to service_role;

alter table public.verification_status enable row level security;

-- Users can read only their own verification row
create policy "Users view own verification"
  on public.verification_status for select to authenticated
  using (auth.uid() = user_id);

-- No insert/update policies for authenticated → only service_role (admin) can modify.

-- Timestamp trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger verification_touch before update on public.verification_status
  for each row execute function public.touch_updated_at();

-- Auto-create profile and verification rows on new auth user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.verification_status (user_id, status)
    values (new.id, 'unverified') on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- When selfie is uploaded, auto-move status to pending_review
create or replace function public.selfie_uploaded()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.selfie_url is not null and (old.selfie_url is null or old.selfie_url = '') then
    update public.verification_status
      set status = 'pending'
      where user_id = new.id and status = 'unverified';
  end if;
  return new;
end $$;

create trigger profiles_selfie_uploaded
  after update of selfie_url on public.profiles
  for each row execute function public.selfie_uploaded();
