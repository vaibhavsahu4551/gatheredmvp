
-- Trigger to notify post owner on like
CREATE OR REPLACE FUNCTION public.post_like_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.notifications(user_id, kind, actor_id, target_id)
    VALUES (owner, 'post_like', NEW.user_id, NEW.post_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_post_like_notify ON public.post_likes;
CREATE TRIGGER trg_post_like_notify AFTER INSERT ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.post_like_notify();

CREATE OR REPLACE FUNCTION public.post_comment_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.notifications(user_id, kind, actor_id, target_id)
    VALUES (owner, 'post_comment', NEW.user_id, NEW.post_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_post_comment_notify ON public.post_comments;
CREATE TRIGGER trg_post_comment_notify AFTER INSERT ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.post_comment_notify();
