import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getProfilesLite } from "@/lib/events";
import { signedFeedUrl, getLikes, toggleLike, deletePost, getEventsLite } from "@/lib/feed";
import { PostCard, type PostItem } from "@/components/PostCard";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/posts/$postId")({
  component: PostDetail,
});

function PostDetail() {
  const { postId } = Route.useParams();
  const navigate = useNavigate();
  const [me, setMe] = useState<string>("");
  const [post, setPost] = useState<PostItem | null>(null);
  const [img, setImg] = useState<string>("");
  const [name, setName] = useState<string>("Member");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [linked, setLinked] = useState<any>(null);
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setMe(user.id);
      const { data, error } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
      if (error || !data) { setLoading(false); return; }
      setPost({ ...(data as any), kind: "post" });
      if (data.photo_url) setImg(await signedFeedUrl(data.photo_url));
      const profs = await getProfilesLite([data.user_id]);
      const info = (profs as any)[data.user_id];
      setName(info?.full_name ?? "Member");
      setAvatar(info?.photo ?? null);
      if (data.event_id) {
        const evs = await getEventsLite([data.event_id]);
        setLinked((evs as any)[data.event_id] ?? null);
      }
      const { counts, mine } = await getLikes([postId]);
      setCount(counts[postId] ?? 0);
      setLiked(mine.has(postId));
      setLoading(false);
    })();
  }, [postId]);

  const onLike = async () => {
    const now = await toggleLike(postId);
    setLiked(now);
    setCount((c) => c + (now ? 1 : -1));
  };
  const onDelete = async () => {
    if (!confirm("Delete this post?")) return;
    await deletePost(postId);
    navigate({ to: "/" });
  };

  return (
    <div>
      <header className="px-4 pt-6 pb-3 flex items-center gap-3 border-b border-border">
        <button onClick={() => history.length > 1 ? history.back() : navigate({ to: "/" })}
          className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="text-base font-semibold">Post</div>
      </header>
      <div className="p-4">
        {loading && <div className="text-sm text-muted-foreground text-center py-10">Loading…</div>}
        {!loading && !post && <div className="text-sm text-muted-foreground text-center py-10">Post not found.</div>}
        {post && (
          <PostCard
            p={post}
            img={img}
            name={name}
            avatarPhoto={avatar}
            linked={linked}
            liked={liked}
            likeCount={count}
            onLike={onLike}
            onDelete={me && me === post.user_id ? onDelete : undefined}
          />
        )}
      </div>
    </div>
  );
}
