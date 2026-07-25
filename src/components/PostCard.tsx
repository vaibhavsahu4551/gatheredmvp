import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Heart, MessageSquare, Link2 } from "lucide-react";
import { SafetyMenu } from "@/components/SafetyMenu";


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
    <article className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-3 pt-2.5 pb-2 flex items-center justify-between">
        <div className="text-[13px] font-medium">{name}</div>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Post</span>
      </div>
      {img && <img src={img} className="w-full aspect-square object-cover" alt="" />}
      {p.caption && <div className="px-3 pt-2 text-[14px] whitespace-pre-wrap">{p.caption}</div>}
      {linked && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate({ to: "/events/$eventId", params: { eventId: linked.id } });
          }}
          className="mx-3 mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-[12px] font-medium"
        >
          <Link2 className="h-3 w-3" />
          {linked.event_type ? `${linked.event_type} at ${linked.title}` : linked.title}
        </button>
      )}
      <div className="px-3 py-2 mt-1 flex items-center gap-4 text-sm">
        <button onClick={onLike} className="flex items-center gap-1.5">
          <Heart className={`h-4 w-4 ${liked ? "fill-red-500 text-red-500" : ""}`} /> {likeCount}
        </button>
        <button onClick={() => { setOpenC((v) => !v); if (!openC) load(); }} className="flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" /> Comments
        </button>
        <span className="ml-auto text-[11px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
      </div>
      {openC && (
        <div className="border-t border-border px-3 py-2 space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="text-[13px]"><span className="font-medium">Guest</span> {c.body}</div>
          ))}
          <div className="flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" className="flex-1 rounded-full border border-border px-3 py-1.5 text-sm" />
            <button onClick={submit} className="rounded-full bg-primary text-primary-foreground px-3 text-sm">Send</button>
          </div>
        </div>
      )}
    </article>
  );
}
