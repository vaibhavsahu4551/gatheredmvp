import { useNavigate } from "@tanstack/react-router";
import { Avatar } from "@/components/Avatar";
import { Link2, X } from "lucide-react";
import { getOrCreateThread } from "@/lib/dm";
import { toast } from "sonner";

export type LinkupPeer = {
  id: string;
  name: string | null;
  photo: string | null;
  interests?: string[] | null;
};

export function LinkupConfirmModal({
  me,
  other,
  open,
  onClose,
}: {
  me: LinkupPeer;
  other: LinkupPeer;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  if (!open) return null;

  const myInts = new Set((me.interests ?? []).map((s) => s.toLowerCase()));
  const shared = (other.interests ?? []).filter((t) => myInts.has(t.toLowerCase()));

  const sayHi = async () => {
    try {
      const threadId = await getOrCreateThread(other.id);
      onClose();
      navigate({ to: "/messages/$threadId", params: { threadId } });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't open chat");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-3xl overflow-hidden bg-card shadow-2xl">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-muted flex items-center justify-center z-10"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="bg-gradient-brand-soft px-6 pt-8 pb-6 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand)]">
            Linkup confirmed
          </div>
          <h2 className="mt-1 text-2xl font-bold leading-tight">
            You're Linked with{" "}
            <span className="bg-gradient-brand bg-clip-text text-transparent">
              {other.name ?? "them"}
            </span>
            !
          </h2>

          <div className="mt-6 flex items-center justify-center gap-3">
            <Avatar photo={me.photo} name={me.name} size={72} />
            <div className="flex-1 max-w-[80px] flex items-center justify-center relative">
              <div className="w-full border-t-2 border-dashed border-[color:var(--brand)]/60" />
              <div className="absolute h-8 w-8 rounded-full bg-gradient-brand flex items-center justify-center shadow-md">
                <Link2 className="h-4 w-4 text-white" />
              </div>
            </div>
            <Avatar photo={other.photo} name={other.name} size={72} />
          </div>
        </div>

        <div className="px-6 py-5">
          {shared.length > 0 ? (
            <>
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                You both like
              </div>
              <div className="flex flex-wrap gap-1.5">
                {shared.map((t) => (
                  <span
                    key={t}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-gradient-brand-soft text-[color:var(--brand)] font-semibold"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground text-center">
              Say hi and find your shared vibe.
            </div>
          )}

          <button
            onClick={sayHi}
            className="mt-5 w-full h-12 rounded-full bg-gradient-brand text-white text-sm font-bold shadow-md"
          >
            Say Hi 👋
          </button>
          <button
            onClick={onClose}
            className="mt-2 w-full h-10 rounded-full text-sm font-semibold text-muted-foreground"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
