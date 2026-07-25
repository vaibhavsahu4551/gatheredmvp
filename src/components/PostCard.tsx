import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { Heart, MessageSquare, Link2, Trash2 } from "lucide-react";
import { SafetyMenu } from "@/components/SafetyMenu";
import { ShareButton } from "@/components/ShareToConnection";
import { eventTypeStyle } from "@/lib/event-style";

export type PostItem = {
  kind: "post";
  id: string;
  created_at: string;
  user_id: string;
  caption: string | null;
  photo_url: string | null;
  event_id: string | null;
};

export function PostCard({
  p,
  img,
  name,
  linked,
  liked,
  likeCount,
  onLike,
}: {
  p: PostItem;
  img?: string;
  name: string;
  linked?: { id: string; title: string; event_type: string | null };
  liked: boolean;
  likeCount: number;
  onLike: () => void;
}) {
  const navigate = useNavigate();
  const [openC, setOpenC] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");
  const linkedStyle = linked ? eventTypeStyle(linked.event_type) : null;

  const load = async () => {
    const { listComments } = await import("@/lib/feed");
    setComments(await listComments(p.id));
  };
  const submit = async () => {
    if (!text.trim()) return;
    const { addComment } = await import("@/lib/feed");
    await addComment(p.id, text.trim());
    setText("");
    await load();
  };

  return (
    <article className="rounded-2xl bg-card overflow-hidden shadow-card ring-1 ring-black/[0.04]">
      <div className="px-3 pt-2.5 pb-2 flex items-center justify-between">
        <Link to="/u/$userId" params={{ userId: p.user_id }} className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-full bg-gradient-brand shrink-0" />
          <div className="text-[13px] font-semibold truncate hover:underline">{name}</div>
        </Link>
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide font-bold text-gradient-brand">Post</span>
          <SafetyMenu targetType="user" targetId={p.user_id} userId={p.user_id} />
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
          {comments.map((c) => (
            <div key={c.id} className="text-[13px]"><span className="font-semibold">Guest</span> {c.body}</div>
          ))}
          <div className="flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" className="flex-1 rounded-full border border-border bg-white px-3 py-1.5 text-sm" />
            <button onClick={submit} className="rounded-full bg-gradient-brand text-white px-4 text-sm font-semibold">Send</button>
          </div>
        </div>
      )}
    </article>
  );
}
