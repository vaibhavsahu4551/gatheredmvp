import { useState } from "react";
import { X, ShieldCheck, Copy, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { createCheckinLink, checkinSmsBody } from "@/lib/pride-extras";

/**
 * Optional trusted-contact check-in. The generated link and message contain
 * only generic details (date/time, general area, expected-back time) — never
 * the event name, exact address, or anything Pride-related.
 */
export function CheckInSheet({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const [phone, setPhone] = useState("");
  const [hours, setHours] = useState(4);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const url = await createCheckinLink(eventId, phone, hours);
      setLink(url);
      toast.success("Check-in link ready");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't create the link");
    } finally {
      setBusy(false);
    }
  };

  const body = link ? checkinSmsBody(link) : "";

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">Notify a trusted contact</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Optional. They'll see only the date, time, general area and when to expect you back —
              no event name, no address, and nothing about who you're meeting.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!link ? (
          <>
            <label className="block text-sm">
              <span className="text-muted-foreground text-xs">Contact's phone number (optional)</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="+91 90000 00000"
                className="mt-1 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground text-xs">Expect me back within</span>
              <select
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="mt-1 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
              >
                {[2, 3, 4, 5, 6, 8, 12].map((h) => <option key={h} value={h}>{h} hours</option>)}
              </select>
            </label>
            <button
              onClick={generate}
              disabled={busy}
              className="w-full rounded-full bg-gradient-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Creating…" : "Send check-in link"}
            </button>
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-muted/40 p-3 text-xs break-all">{body}</div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`sms:${phone.replace(/\s/g, "")}?&body=${encodeURIComponent(body)}`}
                className="rounded-full bg-gradient-brand py-3 text-sm font-semibold text-white text-center inline-flex items-center justify-center gap-1.5"
              >
                <MessageSquare className="h-4 w-4" /> Send SMS
              </a>
              <button
                onClick={async () => {
                  try {
                    if (navigator.share) await navigator.share({ text: body });
                    else { await navigator.clipboard.writeText(body); toast.success("Copied"); }
                  } catch { /* dismissed */ }
                }}
                className="rounded-full border border-border py-3 text-sm font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <Copy className="h-4 w-4" /> Share / copy
              </button>
            </div>
            <button onClick={onClose} className="w-full text-sm text-muted-foreground py-1">Done</button>
          </>
        )}
      </div>
    </div>
  );
}
