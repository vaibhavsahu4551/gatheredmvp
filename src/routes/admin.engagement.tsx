import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  adminListPrompts, adminUpsertPrompt, adminDeletePrompt, adminSetTodayPrompt,
  adminPromptHistory, adminPromptResponses, adminListChallenges, adminUpsertChallenge,
  adminDeleteChallenge, adminSetWeekChallenge, adminChallengeStats,
  type AdminPrompt, type PromptHistory, type PromptResponse, type AdminChallenge, type ChallengeStats,
} from "@/lib/admin-engagement";

export const Route = createFileRoute("/admin/engagement")({
  ssr: false,
  component: AdminEngagement,
});

const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const GOALS = ["join_event", "host_event", "linkup", "post"] as const;
const REWARDS = ["badge", "boost", "trial"] as const;

function AdminEngagement() {
  const [tab, setTab] = useState<"ice" | "challenge">("ice");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Engagement</h1>
        <p className="text-sm text-muted-foreground">Daily icebreakers and weekly challenges. Pride activity is excluded.</p>
      </div>
      <div className="flex gap-2 text-sm">
        {([["ice", "Icebreakers"], ["challenge", "Weekly challenges"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-full px-3 py-1 border ${tab === k ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}>
            {l}
          </button>
        ))}
      </div>
      {tab === "ice" ? <Icebreakers /> : <Challenges />}
    </div>
  );
}

function Icebreakers() {
  const [prompts, setPrompts] = useState<AdminPrompt[]>([]);
  const [history, setHistory] = useState<PromptHistory[]>([]);
  const [responses, setResponses] = useState<PromptResponse[]>([]);
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<AdminPrompt | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [p, h, r] = await Promise.all([adminListPrompts(), adminPromptHistory(30), adminPromptResponses(20)]);
      setPrompts(p ?? []); setHistory(h ?? []); setResponses(r ?? []);
    } catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { refresh(); }, []);

  const today = history[0];

  async function save() {
    if (!body.trim()) return toast.error("Enter prompt text");
    setBusy(true);
    try {
      await adminUpsertPrompt(editing?.id ?? null, body.trim(), editing?.active ?? true);
      toast.success(editing ? "Prompt updated" : "Prompt added");
      setBody(""); setEditing(null); await refresh();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border p-4">
        <div className="text-sm font-semibold">Today's live prompt</div>
        {today ? (
          <>
            <div className="mt-1 text-sm">{today.body}</div>
            <div className="text-xs text-muted-foreground mt-1">{today.day} · {today.responses} responses</div>
          </>
        ) : <div className="mt-1 text-sm text-muted-foreground">No prompt rolled yet today.</div>}
        {responses.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="text-xs font-medium text-muted-foreground">Recent responses</div>
            {responses.slice(0, 8).map((r) => (
              <div key={r.id} className="text-xs border-t border-border py-1.5">
                <span className="font-medium">{r.full_name ?? "Member"}</span>
                <span className="text-muted-foreground"> · {r.caption ?? ""}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border p-4 space-y-2 bg-muted/20">
        <div className="text-sm font-semibold">{editing ? "Edit prompt" : "Add prompt"}</div>
        <textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} className={input}
          placeholder="What's the one thing you'd do with a free Sunday?" />
        <div className="flex gap-2">
          <button disabled={busy} onClick={save} className="rounded-lg bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50">
            {busy ? "Saving…" : editing ? "Update" : "Add prompt"}
          </button>
          {editing && <button onClick={() => { setEditing(null); setBody(""); }} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Prompt bank</h2>
        <table className="mt-3 w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-2">Prompt</th><th>Status</th><th>Used</th><th /></tr></thead>
          <tbody>
            {prompts.map((p) => (
              <tr key={p.id} className="border-t border-border align-top">
                <td className="py-2 pr-3">{p.body}</td>
                <td className="whitespace-nowrap">{p.active ? "Active" : "Off"}</td>
                <td>{p.uses}</td>
                <td className="whitespace-nowrap text-xs space-x-2 py-2">
                  <button className="underline" onClick={() => { setEditing(p); setBody(p.body); }}>Edit</button>
                  <button className="underline" onClick={async () => {
                    try { await adminUpsertPrompt(p.id, p.body, !p.active); await refresh(); } catch (e: any) { toast.error(e.message); }
                  }}>{p.active ? "Disable" : "Enable"}</button>
                  <button className="underline" onClick={async () => {
                    try { await adminSetTodayPrompt(p.id); toast.success("Set as today's prompt"); await refresh(); } catch (e: any) { toast.error(e.message); }
                  }}>Set live today</button>
                  <button className="underline text-destructive" onClick={async () => {
                    if (!confirm("Delete this prompt?")) return;
                    try { await adminDeletePrompt(p.id); await refresh(); } catch (e: any) { toast.error(e.message); }
                  }}>Delete</button>
                </td>
              </tr>
            ))}
            {prompts.length === 0 && <tr><td className="py-3 text-sm text-muted-foreground" colSpan={4}>No prompts yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-sm font-semibold">History</h2>
        <table className="mt-3 w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-2">Date</th><th>Prompt</th><th>Responses</th></tr></thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.day} className="border-t border-border">
                <td className="py-2 whitespace-nowrap">{h.day}</td>
                <td className="pr-3">{h.body}</td>
                <td>{h.responses}</td>
              </tr>
            ))}
            {history.length === 0 && <tr><td className="py-3 text-sm text-muted-foreground" colSpan={3}>Nothing yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const emptyChallenge = {
  id: null as string | null, title: "", description: "", goal_type: "join_event",
  goal_target: 1, reward_kind: "badge", reward_amount: 1, badge_name: "Achiever", active: true,
};

function Challenges() {
  const [rows, setRows] = useState<AdminChallenge[]>([]);
  const [stats, setStats] = useState<ChallengeStats | null>(null);
  const [form, setForm] = useState({ ...emptyChallenge });
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [c, s] = await Promise.all([adminListChallenges(), adminChallengeStats()]);
      setRows(c ?? []); setStats(s);
    } catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { refresh(); }, []);

  async function save() {
    setBusy(true);
    try {
      await adminUpsertChallenge(form as any);
      toast.success(form.id ? "Challenge updated" : "Challenge added");
      setForm({ ...emptyChallenge }); await refresh();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border p-4">
        <div className="text-sm font-semibold">This week</div>
        {stats ? (
          <>
            <div className="mt-1 text-sm">{stats.title}</div>
            <div className="mt-3 grid grid-cols-4 gap-3 text-center">
              {[["Completed", stats.completions], ["Badges", stats.badge_count], ["Boosts", stats.boost_count], ["Trials", stats.trial_count]].map(([l, v]) => (
                <div key={l as string} className="rounded-lg border border-border p-3">
                  <div className="text-[11px] text-muted-foreground">{l}</div>
                  <div className="text-lg font-bold">{v as number}</div>
                </div>
              ))}
            </div>
          </>
        ) : <div className="mt-1 text-sm text-muted-foreground">No challenge assigned this week yet.</div>}
      </section>

      <section className="rounded-xl border border-border p-4 space-y-2 bg-muted/20">
        <div className="text-sm font-semibold">{form.id ? "Edit challenge" : "New challenge"}</div>
        <input className={input} placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea rows={2} className={input} placeholder="Description" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <label className="text-xs">Goal type
            <select className={input} value={form.goal_type} onChange={(e) => setForm({ ...form, goal_type: e.target.value })}>
              {GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label className="text-xs">Target
            <input type="number" className={input} value={form.goal_target} onChange={(e) => setForm({ ...form, goal_target: parseInt(e.target.value || "1", 10) })} />
          </label>
          <label className="text-xs">Reward
            <select className={input} value={form.reward_kind} onChange={(e) => setForm({ ...form, reward_kind: e.target.value })}>
              {REWARDS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="text-xs">Reward value
            <input type="number" className={input} value={form.reward_amount} onChange={(e) => setForm({ ...form, reward_amount: parseInt(e.target.value || "1", 10) })} />
          </label>
        </div>
        {form.reward_kind === "badge" && (
          <input className={input} placeholder="Badge name" value={form.badge_name ?? ""} onChange={(e) => setForm({ ...form, badge_name: e.target.value })} />
        )}
        <div className="flex gap-2">
          <button disabled={busy} onClick={save} className="rounded-lg bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50">
            {busy ? "Saving…" : form.id ? "Update" : "Add challenge"}
          </button>
          {form.id && <button onClick={() => setForm({ ...emptyChallenge })} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Challenge bank</h2>
        <table className="mt-3 w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-2">Title</th><th>Goal</th><th>Reward</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-border align-top">
                <td className="py-2 pr-3">{c.title}</td>
                <td className="whitespace-nowrap">{c.goal_type} × {c.goal_target}</td>
                <td className="whitespace-nowrap">{c.reward_kind} {c.reward_kind === "badge" ? (c.badge_name ?? "") : c.reward_amount}</td>
                <td>{c.active ? "Active" : "Off"}</td>
                <td className="whitespace-nowrap text-xs space-x-2 py-2">
                  <button className="underline" onClick={() => setForm({
                    id: c.id, title: c.title, description: c.description ?? "", goal_type: c.goal_type,
                    goal_target: c.goal_target, reward_kind: c.reward_kind, reward_amount: c.reward_amount,
                    badge_name: c.badge_name ?? "", active: c.active,
                  })}>Edit</button>
                  <button className="underline" onClick={async () => {
                    try { await adminSetWeekChallenge(c.id); toast.success("Set as this week's challenge"); await refresh(); } catch (e: any) { toast.error(e.message); }
                  }}>Set this week</button>
                  <button className="underline text-destructive" onClick={async () => {
                    if (!confirm("Delete this challenge?")) return;
                    try { await adminDeleteChallenge(c.id); await refresh(); } catch (e: any) { toast.error(e.message); }
                  }}>Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="py-3 text-sm text-muted-foreground" colSpan={5}>No challenges yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
