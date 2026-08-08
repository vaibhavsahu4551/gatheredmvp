import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { Heart, MessageSquare, Link2, Trash2, Sparkles } from "lucide-react";
import { SafetyMenu } from "@/components/SafetyMenu";
import { ShareButton } from "@/components/ShareToConnection";
import { Avatar } from "@/components/Avatar";
import { eventTypeStyle } from "@/lib/event-style";

export type PostItem = {
  kind: "post";
  id: string;
  created_at: string;
  user_id: string;
  caption: string | null;
  photo_url: string | null;
  event_id: string | null;
  prompt_id?: string | null;
};

export function PostCard({
  p,
  img,
  name,
  avatarPhoto,
  linked,
  prompt,
  liked,
  likeCount,
  onLike,
  onDelete,
}: {
  p: PostItem;
  img?: string;
  name: string;
  avatarPhoto?: string | null;
  linked?: { id: string; title: string; event_type: string | null };
  prompt?: string | null;
  liked: boolean;
  likeCount: number;
  onLike: () => void;
  onDelete?: () => void;
}) {
  const navigate = useNavigate();
  const [openC, setOpenC] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");
  const linkedStyle = linked ? eventTypeStyle(linked.event_type) : null;
  const promptChip = prompt ? (
    <Link to="/icebreaker" className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-gradient-brand-soft px-3 py-1 text-[11px] font-semibold text-foreground/80">
      <Sparkles className="h-3 w-3" /> {prompt}
    </Link>
  ) : null;


  const [authors, setAuthors] = useState<Record<string, { full_name: string | null; photo: string | null }>>({});
  const load = async () => {
    const { listComments } = await import("@/lib/feed");
    const { getProfilesLite } = await import("@/lib/events");
    const cs = await listComments(p.id);
    setComments(cs);
    const ids = Array.from(new Set(cs.map((c: any) => c.user_id).filter(Boolean))) as string[];
    if (ids.length) setAuthors(await getProfilesLite(ids) as any);
  };
  const submit = async () => {
    if (!text.trim()) return;
    const { addComment } = await import("@/lib/feed");
    await addComment(p.id, text.trim());
    setText("");
    await load();
  };
  const renderComment = (c: any) => {
    const a = authors[c.user_id];
    const nm = a?.full_name ?? "Someone";
    return (
      <div key={c.id} className="flex gap-2 items-start">
        <Link to="/u/$userId" params={{ userId: c.user_id }} className="shrink-0 mt-0.5">
          <Avatar photo={a?.photo ?? null} name={nm} size={24} />
        </Link>
        <div className="text-[13px] leading-snug">
          <Link to="/u/$userId" params={{ userId: c.user_id }} className="font-semibold hover:underline">{nm}</Link>{" "}
          <span>{c.body}</span>
        </div>
      </div>
    );
  };

  const isTextOnly = !img;

  if (isTextOnly) {
    return (
      <article className="bg-background px-4 py-3 border-b border-border">
        <div className="flex gap-3">
          <Link to="/u/$userId" params={{ userId: p.user_id }} className="shrink-0">
            <Avatar photo={avatarPhoto} name={name} size={40} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <Link to="/u/$userId" params={{ userId: p.user_id }} className="flex items-center gap-1.5 min-w-0">
                <span className="text-[14px] font-bold truncate hover:underline">{name}</span>
                <span className="text-[13px] text-muted-foreground shrink-0">· {new Date(p.created_at).toLocaleDateString()}</span>
              </Link>
              {onDelete ? (
                <button
                  type="button"
                  onClick={() => { if (confirm("Delete this post? This will remove all its likes and comments.")) onDelete(); }}
                  className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive shrink-0"
                  aria-label="Delete post"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : (
                <SafetyMenu targetType="user" targetId={p.user_id} userId={p.user_id} />
              )}
            </div>
            {promptChip}
            {p.caption && (
              <div className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap text-foreground">{p.caption}</div>
            )}
            {linked && linkedStyle && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate({ to: "/events/$eventId", params: { eventId: linked.id } });
                }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold text-white shadow-sm"
                style={{ backgroundImage: linkedStyle.gradient }}
              >
                <Link2 className="h-3 w-3" />
                {linked.event_type ? `${linked.event_type} · ${linked.title}` : linked.title}
              </button>
            )}
            <div className="mt-3 flex items-center gap-6 text-sm text-muted-foreground">
              <button onClick={onLike} className="flex items-center gap-1.5 hover:text-foreground">
                <Heart className={`h-4 w-4 transition ${liked ? "fill-red-500 text-red-500 scale-110" : ""}`} /> {likeCount}
              </button>
              <button onClick={() => { setOpenC((v) => !v); if (!openC) load(); }} className="flex items-center gap-1.5 hover:text-foreground">
                <MessageSquare className="h-4 w-4" /> Comments
              </button>
              <ShareButton kind="post" id={p.id} />
            </div>
            {openC && (
              <div className="mt-3 border-t border-border pt-2 space-y-2">
                {comments.map(renderComment)}
                <div className="flex gap-2">
                  <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" className="flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm" />
                  <button onClick={submit} className="rounded-full bg-gradient-brand text-white px-4 text-sm font-semibold">Send</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-2xl bg-card overflow-hidden shadow-card ring-1 ring-black/[0.04]">
      <div className="px-3 pt-2.5 pb-2 flex items-center justify-between">
        <Link to="/u/$userId" params={{ userId: p.user_id }} className="flex items-center gap-2 min-w-0">
          <Avatar photo={avatarPhoto} name={name} size={28} />
          <div className="text-[13px] font-semibold truncate hover:underline">{name}</div>
        </Link>
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide font-bold text-gradient-brand">Post</span>
          {onDelete ? (
            <button
              type="button"
              onClick={() => { if (confirm("Delete this post? This will remove all its likes and comments.")) onDelete(); }}
              className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive"
              aria-label="Delete post"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : (
            <SafetyMenu targetType="user" targetId={p.user_id} userId={p.user_id} />
          )}
        </div>
      </div>

      {img && <img src={img} className="w-full aspect-square object-cover" alt="" />}
      {p.caption && <div className="px-3 pt-2 text-[14px] whitespace-pre-wrap">{p.caption}</div>}
      {linked && linkedStyle && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate({ to: "/events/$eventId", params: { eventId: linked.id } });
          }}
          className="mx-3 mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold text-white shadow-sm"
          style={{ backgroundImage: linkedStyle.gradient }}
        >
          <Link2 className="h-3 w-3" />
          {linked.event_type ? `${linked.event_type} · ${linked.title}` : linked.title}
        </button>
      )}
      <div className="px-3 py-2 mt-1 flex items-center gap-4 text-sm">
        <button onClick={onLike} className="flex items-center gap-1.5">
          <Heart className={`h-4 w-4 transition ${liked ? "fill-red-500 text-red-500 scale-110" : ""}`} /> {likeCount}
        </button>
        <button onClick={() => { setOpenC((v) => !v); if (!openC) load(); }} className="flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" /> Comments
        </button>
        <ShareButton kind="post" id={p.id} />
        <span className="ml-auto text-[11px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
      </div>
      {openC && (
        <div className="border-t border-border px-3 py-2 space-y-2 bg-gradient-brand-soft/40">
          {comments.map(renderComment)}
          <div className="flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" className="flex-1 rounded-full border border-border bg-white px-3 py-1.5 text-sm" />
            <button onClick={submit} className="rounded-full bg-gradient-brand text-white px-4 text-sm font-semibold">Send</button>
          </div>
        </div>
      )}
    </article>
  );
}
