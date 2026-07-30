import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SettingsShell } from "@/components/SettingsUI";
import { submitSupportTicket, SUPPORT_EMAIL } from "@/lib/settings";

export const Route = createFileRoute("/_authenticated/_app/settings/report")({
  head: () => ({
    meta: [
      { title: "Report a problem — Gathr" },
      { name: "description", content: "Tell the Gathr team about a bug or problem you ran into." },
      { property: "og:title", content: "Report a problem — Gathr" },
      { property: "og:description", content: "Tell the Gathr team about a bug or problem you ran into." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportProblem,
});

function ReportProblem() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await submitSupportTicket(text, file);
      toast.success("Thanks — we've received your report");
      setText(""); setFile(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't send your report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsShell title="Report a problem">
      <div className="space-y-4">
        <textarea
          rows={6}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What went wrong? The more detail, the faster we can fix it."
          className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <label className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 cursor-pointer">
          <div className="text-[15px] font-medium">Screenshot <span className="text-muted-foreground font-normal">(optional)</span></div>
          <span className="text-sm text-muted-foreground truncate max-w-[45%]">{file ? file.name : "Choose"}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <button onClick={submit} disabled={busy} className="w-full rounded-full bg-gradient-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-50">
          {busy ? "Sending…" : "Send report"}
        </button>
        <p className="text-xs text-muted-foreground text-center">
          Prefer email? Write to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary">{SUPPORT_EMAIL}</a>
        </p>
      </div>
    </SettingsShell>
  );
}
