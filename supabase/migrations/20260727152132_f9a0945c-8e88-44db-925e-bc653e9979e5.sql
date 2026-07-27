
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS early_access boolean NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS boost_weight integer NOT NULL DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS pride_premium_only boolean NOT NULL DEFAULT false;
ALTER TABLE public.verification_status ADD COLUMN IF NOT EXISTS priority boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.count_events_created_last_30d(_user uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.events
   WHERE host_id = _user AND created_at > now() - interval '30 days';
$$;

CREATE OR REPLACE FUNCTION public.count_events_joined_last_30d(_user uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.event_participants
   WHERE user_id = _user AND created_at > now() - interval '30 days'
     AND status IN ('pending','approved');
$$;

GRANT EXECUTE ON FUNCTION public.count_events_created_last_30d(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_events_joined_last_30d(uuid) TO authenticated;

-- Sync helpers when a user turns premium.
CREATE OR REPLACE FUNCTION public.sync_premium_flags()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.subscription_tier = 'premium' AND (OLD.subscription_tier IS DISTINCT FROM 'premium') THEN
    UPDATE public.verification_status SET priority = true WHERE user_id = NEW.id;
    UPDATE public.events SET boost_weight = 100 WHERE host_id = NEW.id AND status IN ('pending','confirmed');
    NEW.early_access := true;
  ELSIF NEW.subscription_tier = 'free' AND OLD.subscription_tier = 'premium' THEN
    UPDATE public.verification_status SET priority = false WHERE user_id = NEW.id;
    UPDATE public.events SET boost_weight = 0 WHERE host_id = NEW.id;
    NEW.early_access := false;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_premium_flags ON public.profiles;
CREATE TRIGGER trg_sync_premium_flags
BEFORE UPDATE OF subscription_tier ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_premium_flags();

-- Auto-boost new events for premium hosts.
CREATE OR REPLACE FUNCTION public.auto_boost_new_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tier text;
BEGIN
  SELECT subscription_tier INTO tier FROM public.profiles WHERE id = NEW.host_id;
  IF tier = 'premium' THEN NEW.boost_weight := 100; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_boost_new_event ON public.events;
CREATE TRIGGER trg_auto_boost_new_event
BEFORE INSERT ON public.events
FOR EACH ROW EXECUTE FUNCTION public.auto_boost_new_event();
