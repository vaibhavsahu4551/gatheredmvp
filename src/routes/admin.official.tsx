import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { generateCheckinLink, revokeCheckinLinks } from "@/lib/checkin";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PhotoCropModal } from "@/components/PhotoCropModal";
import { PassManager } from "@/components/PassManager";
import {
  createApplicationQuestion,
  deleteApplicationQuestion,
  getApplicationQuestions,
  updateApplicationQuestion,
  listOfficialApplications,
  acceptApplication,
  rejectApplication,
  generateOrganiserLink,
  type OfficialApplicationQuestion,
  type OfficialApplicationQuestionType,
  type OfficialApplication,
} from "@/lib/official-applications";
import {
  OFFICIAL_CATEGORIES,
  adminCreateOfficialEvent,
  adminDeleteOfficialEvent,
  adminListOfficialEvents,
  adminUpdateOfficialEvent,
  officialStats,
  resolveOfficialMedia,
  uploadOfficialMedia,
  type OfficialEvent,
  type OfficialEventInput,
} from "@/lib/official-events";
import {
  adminListCoupons,
  adminCreateCoupon,
  adminUpdateCoupon,
  adminDeleteCoupon,
  type OfficialEventCoupon,
  type CouponDiscountType,
} from "@/lib/official-passes";
export const Route = createFileRoute("/admin/official")({
  component: AdminOfficialEvents,
});

const emptyForm = {
  title: "",
  category: OFFICIAL_CATEGORIES[0] as string,
  description: "",
  cover_url: "",
  ticket_bg_url: "",
  date: "",
  time: "19:00",
  end_time: "",
  venue: "",
  city: "",
  price_text: "",
  pass_price: "",
  pass_quantity: "",
  pass_info: "",
  contact_phone: "",
  instructions: "",
  upi_id: "",
  upi_payee_name: "",
  organizer_name: "",
  organizer_logo: "",
  booking_whatsapp: "",
  ticket_url: "",
  terms: "",
  published: true,
  is_featured: false,
  is_pinned: false,
  
  booking_type: "instant" as "instant" | "selection",
  organiser_user_id: "",
  selection_payment_deadline_minutes: "30",
  razorpay_enabled: false,
};
type Form = typeof emptyForm;

function toForm(e: OfficialEvent): Form {
  const d = new Date(e.starts_at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    title: e.title,
    category: e.category,
    description: e.description ?? "",
    cover_url: e.cover_url ?? "",
    ticket_bg_url: e.ticket_bg_url ?? "",
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    end_time: e.ends_at ? `${pad(new Date(e.ends_at).getHours())}:${pad(new Date(e.ends_at).getMinutes())}` : "",
    venue: e.venue,
    city: e.city,
    price_text: e.price_text ?? "",
    pass_price: e.pass_price != null ? String(e.pass_price) : "",
    pass_quantity: e.pass_quantity != null ? String(e.pass_quantity) : "",
    pass_info: e.pass_info ?? "",
    contact_phone: e.contact_phone ?? "",
    instructions: e.instructions ?? "",
    upi_id: e.upi_id ?? "",
    upi_payee_name: e.upi_payee_name ?? "",
    organizer_name: e.organizer_name,
    organizer_logo: e.organizer_logo ?? "",
    booking_whatsapp: e.booking_whatsapp ?? "",
    ticket_url: e.ticket_url ?? "",
    terms: e.terms ?? "",
    published: e.published,
    is_featured: e.is_featured,
    is_pinned: e.is_pinned,
    booking_type: e.booking_type ?? "instant",
    organiser_user_id: e.organiser_user_id ?? "",
    selection_payment_deadline_minutes: String(
      e.selection_payment_deadline_minutes ?? 30
      ),
      razorpay_enabled: e.razorpay_enabled ?? false,
  };
}

function AdminOfficialEvents() {
  const [rows, setRows] = useState<OfficialEvent[]>([]);
  const [questionsFor, setQuestionsFor] = useState<string | null>(null);
  const [applicationsFor, setApplicationsFor] = useState<string | null>(null);
  const [checkinBusy, setCheckinBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<OfficialEvent | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [passesFor, setPassesFor] = useState<string | null>(null);
const [couponsFor, setCouponsFor] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try { setRows(await adminListOfficialEvents(q)); }
    catch (e: any) { toast.error(e.message ?? "Couldn't load official events"); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  async function toggle(e: OfficialEvent, patch: OfficialEventInput) {
    try { await adminUpdateOfficialEvent(e.id, patch); refresh(); }
    catch (err: any) { toast.error(err.message); }
  }

  async function remove(e: OfficialEvent) {
    if (!confirm(`Delete "${e.title}"? This cannot be undone.`)) return;
    try { await adminDeleteOfficialEvent(e.id); toast.success("Deleted"); refresh(); }
    catch (err: any) { toast.error(err.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Official Events</h1>
          <p className="text-xs text-muted-foreground">Admin-curated partner events. These are separate from user-created events.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm((v) => !v); }}
          className="rounded-lg bg-foreground px-3 py-2 text-sm text-background"
        >
          {showForm && !editing ? "Cancel" : "New official event"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(() => { const st = officialStats(rows); return ([
          ["Total", st.total], ["Published", st.published], ["Draft", st.draft], ["Pinned", st.pinned], ["Featured", st.featured],
        ] as const).map(([label, v]) => (
          <div key={label} className="rounded-xl border border-border p-3">
            <div className="text-lg font-semibold">{v}</div>
            <div className="text-[11px] text-muted-foreground">{label}</div>
          </div>
        )); })()}
      </div>

      {showForm && (
        <OfficialForm
          key={editing?.id ?? "new"}
          initial={editing ? toForm(editing) : emptyForm}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onSaved={async (input) => {
            try {
              if (editing) { await adminUpdateOfficialEvent(editing.id, input); toast.success("Event updated"); }
              else { await adminCreateOfficialEvent(input); toast.success("Event created"); }
              setShowForm(false); setEditing(null); refresh();
            } catch (e: any) { toast.error(e.message); }
          }}
        />
      )}

      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title…"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button onClick={refresh} className="rounded-lg bg-foreground px-3 py-2 text-sm text-background">Search</button>
      </div>

      <div className="space-y-2">
        {loading && <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>}
        {!loading && rows.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">No official events yet.</div>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-border p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Thumb path={r.cover_url} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate font-medium">{r.title}</span>
                  {r.is_pinned && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">📌 Pinned</span>}
                  {r.is_featured && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Featured</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.published ? "bg-green-500/20 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {r.published ? "Published" : "Draft"}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {r.category} · {new Date(r.starts_at).toLocaleString()} · {[r.venue, r.city].filter(Boolean).join(", ") || "—"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {r.organizer_name || "—"} · {r.price_text || "Free / TBA"} · WhatsApp {r.booking_whatsapp || "default"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button onClick={() => toggle(r, { published: !r.published })} className="underline">{r.published ? "Unpublish" : "Publish"}</button>
                <button onClick={() => toggle(r, { is_pinned: !r.is_pinned })} className="underline">{r.is_pinned ? "Unpin" : "Pin"}</button>
                <button onClick={() => toggle(r, { is_featured: !r.is_featured })} className="underline">{r.is_featured ? "Unfeature" : "Feature"}</button>
                <button
  onClick={() =>
    setQuestionsFor((v) => (v === r.id ? null : r.id))
  }
  className="underline"
>
  {questionsFor === r.id ? "Hide questions" : "Questions"}
</button>
                <button
  onClick={() =>
    setApplicationsFor((v) => (v === r.id ? null : r.id))
  }
  className="underline"
>
  {applicationsFor === r.id ? "Hide applications" : "Applications"}
</button>
                <button onClick={() => setPassesFor((v) => (v === r.id ? null : r.id))} className="underline">{passesFor === r.id ? "Hide passes" : "Passes"}</button>
                <button
  onClick={() =>
    setCouponsFor((v) => (v === r.id ? null : r.id))
  }
  className="underline"
>
  {couponsFor === r.id ? "Hide coupons" : "Coupons"}
</button>
                <button
  onClick={() => {
    const link = `https://gathrmeet.in/official/${r.id}`;
    navigator.clipboard.writeText(link);
    toast.success("Event link copied!");
  }}
  className="underline"
>
  Share
</button>
                <button
  onClick={async () => {
    setCheckinBusy(r.id);
    try {
      const result = await generateCheckinLink(r.id);
      await navigator.clipboard.writeText(result.url);
      toast.success("Check-in link copied!");
    } catch (err: any) {
      toast.error(err.message || "Couldn't generate check-in link");
    } finally {
      setCheckinBusy(null);
    }
  }}
  disabled={checkinBusy === r.id}
  className="underline"
>
  {checkinBusy === r.id ? "…" : "Copy check-in link"}
</button>
<button
  onClick={async () => {
    if (!confirm("Regenerate check-in link? The old link will stop working.")) return;
    setCheckinBusy(r.id);
    try {
      await revokeCheckinLinks(r.id);
      const result = await generateCheckinLink(r.id);
      await navigator.clipboard.writeText(result.url);
      toast.success("New check-in link copied!");
    } catch (err: any) {
      toast.error(err.message || "Couldn't regenerate check-in link");
    } finally {
      setCheckinBusy(null);
    }
  }}
  disabled={checkinBusy === r.id}
  className="underline"
>
  Regenerate
</button>
<button
  onClick={async () => {
    if (!confirm("Revoke all check-in links for this event?")) return;
    setCheckinBusy(r.id);
    try {
      await revokeCheckinLinks(r.id);
      toast.success("Check-in links revoked");
    } catch (err: any) {
      toast.error(err.message || "Couldn't revoke");
    } finally {
      setCheckinBusy(null);
    }
  }}
  disabled={checkinBusy === r.id}
  className="text-destructive underline"
>
  Revoke check-in
</button>
                <button onClick={() => { setEditing(r); setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="underline">Edit</button>
                <button onClick={() => remove(r)} className="text-destructive underline">Delete</button>
              </div>
            </div>
            {passesFor === r.id && <PassManager eventId={r.id} />}
            {questionsFor === r.id && (
  <OfficialQuestionManager eventId={r.id} />
)}
            {couponsFor === r.id && (
  <OfficialCouponManager eventId={r.id} />
)}
            {applicationsFor === r.id && (
  <OfficialApplicationsManager eventId={r.id} />
)}
          </div>
        ))}

      </div>
    </div>
  );
}
function OfficialCouponManager({ eventId }: { eventId: string }) {
  const [coupons, setCoupons] = useState<OfficialEventCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] =
    useState<CouponDiscountType>("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [perUserLimit, setPerUserLimit] = useState("1");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [active, setActive] = useState(true);

  async function loadCoupons() {
    setLoading(true);

    try {
      const data = await adminListCoupons(eventId);
      setCoupons(data);
    } catch (error: any) {
      toast.error(error?.message || "Couldn't load coupons");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCoupons();
  }, [eventId]);

  function resetForm() {
    setEditingId(null);
    setCode("");
    setDiscountType("PERCENTAGE");
    setDiscountValue("");
    setUsageLimit("");
    setPerUserLimit("1");
    setStartsAt("");
    setExpiresAt("");
    setActive(true);
  }

  function startEdit(coupon: OfficialEventCoupon) {
    setEditingId(coupon.id);
    setCode(coupon.code);
    setDiscountType(coupon.discount_type);
    setDiscountValue(String(coupon.discount_value));
    setUsageLimit(
      coupon.usage_limit != null
        ? String(coupon.usage_limit)
        : ""
    );
    setPerUserLimit(String(coupon.per_user_limit));

    setStartsAt(
      coupon.starts_at
        ? new Date(coupon.starts_at)
            .toISOString()
            .slice(0, 16)
        : ""
    );

    setExpiresAt(
      coupon.expires_at
        ? new Date(coupon.expires_at)
            .toISOString()
            .slice(0, 16)
        : ""
    );

    setActive(coupon.active);
  }

  async function saveCoupon() {
    const cleanCode = code.trim().toUpperCase();
    const value = Number(discountValue);

    if (!cleanCode) {
      toast.error("Please enter a coupon code.");
      return;
    }

    if (!value || value <= 0) {
      toast.error("Please enter a valid discount value.");
      return;
    }

    if (
      discountType === "PERCENTAGE" &&
      value > 100
    ) {
      toast.error("Percentage discount cannot exceed 100%.");
      return;
    }

    const perUser = Number(perUserLimit);

    if (!perUser || perUser <= 0) {
      toast.error("Per-user limit must be at least 1.");
      return;
    }

    const usage =
      usageLimit.trim() === ""
        ? null
        : Number(usageLimit);

    if (
      usage !== null &&
      (!Number.isInteger(usage) || usage <= 0)
    ) {
      toast.error("Usage limit must be a positive whole number.");
      return;
    }

    if (startsAt && expiresAt) {
      const start = new Date(startsAt).getTime();
      const end = new Date(expiresAt).getTime();

      if (end <= start) {
        toast.error("Expiry must be after start time.");
        return;
      }
    }

    setSaving(true);

    try {
      const input = {
        code: cleanCode,
        discountType,
        discountValue: value,
        usageLimit: usage,
        perUserLimit: perUser,
        startsAt: startsAt
          ? new Date(startsAt).toISOString()
          : null,
        expiresAt: expiresAt
          ? new Date(expiresAt).toISOString()
          : null,
        active,
      };

      if (editingId) {
        await adminUpdateCoupon(editingId, input);
        toast.success("Coupon updated");
      } else {
        await adminCreateCoupon(eventId, input);
        toast.success("Coupon created");
      }

      resetForm();
      await loadCoupons();
    } catch (error: any) {
      toast.error(
        error?.message || "Couldn't save coupon"
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeCoupon(coupon: OfficialEventCoupon) {
    if (
      !confirm(
        `Delete coupon "${coupon.code}"? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await adminDeleteCoupon(coupon.id);

      toast.success("Coupon deleted");

      if (editingId === coupon.id) {
        resetForm();
      }

      await loadCoupons();
    } catch (error: any) {
      toast.error(
        error?.message || "Couldn't delete coupon"
      );
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/20 p-4">
      <div className="mb-4">
        <h3 className="font-semibold">
          Coupons
        </h3>

        <p className="text-xs text-muted-foreground">
          Create discount coupons specifically for this event.
        </p>
      </div>

      {loading ? (
        <div className="py-4 text-center text-sm text-muted-foreground">
          Loading coupons…
        </div>
      ) : (
        <div className="space-y-2">
          {coupons.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No coupons created yet.
            </div>
          )}

          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="rounded-lg border border-border bg-background p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      {coupon.code}
                    </span>

                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        coupon.active
                          ? "bg-green-500/15 text-green-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {coupon.active
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground">
                    {coupon.discount_type === "PERCENTAGE"
                      ? `${coupon.discount_value}% OFF`
                      : `₹${coupon.discount_value} OFF`}
                    {" · "}
                    Per user: {coupon.per_user_limit}
                    {" · "}
                    Total:{" "}
                    {coupon.usage_limit ?? "Unlimited"}
                  </div>

                  {(coupon.starts_at ||
                    coupon.expires_at) && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {coupon.starts_at
                        ? `Starts: ${new Date(
                            coupon.starts_at
                          ).toLocaleString()}`
                        : "Starts: Immediately"}
                      {" · "}
                      {coupon.expires_at
                        ? `Expires: ${new Date(
                            coupon.expires_at
                          ).toLocaleString()}`
                        : "No expiry"}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => startEdit(coupon)}
                    className="underline"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => removeCoupon(coupon)}
                    className="text-destructive underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-xl border border-border bg-background p-4">
        <div className="mb-3">
          <h4 className="text-sm font-semibold">
            {editingId
              ? "Edit Coupon"
              : "Create Coupon"}
          </h4>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">
              Coupon Code
            </label>

            <input
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase())
              }
              placeholder="e.g. GATHR50"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium">
                Discount Type
              </label>

              <select
                value={discountType}
                onChange={(e) =>
                  setDiscountType(
                    e.target.value as CouponDiscountType
                  )
                }
                className={inputCls}
              >
                <option value="PERCENTAGE">
                  Percentage (%)
                </option>

                <option value="FIXED">
                  Fixed amount (₹)
                </option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium">
                Discount Value
              </label>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={discountValue}
                onChange={(e) =>
                  setDiscountValue(e.target.value)
                }
                placeholder={
                  discountType === "PERCENTAGE"
                    ? "50"
                    : "100"
                }
                className={inputCls}
              />
            </div>

            <div>
              <label className="text-xs font-medium">
                Total Usage Limit
              </label>

              <input
                type="number"
                min="1"
                step="1"
                value={usageLimit}
                onChange={(e) =>
                  setUsageLimit(e.target.value)
                }
                placeholder="Leave blank for unlimited"
                className={inputCls}
              />
            </div>

            <div>
              <label className="text-xs font-medium">
                Per User Limit
              </label>

              <input
                type="number"
                min="1"
                step="1"
                value={perUserLimit}
                onChange={(e) =>
                  setPerUserLimit(e.target.value)
                }
                className={inputCls}
              />
            </div>

            <div>
              <label className="text-xs font-medium">
                Start Date & Time
              </label>

              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) =>
                  setStartsAt(e.target.value)
                }
                className={inputCls}
              />
            </div>

            <div>
              <label className="text-xs font-medium">
                Expiry Date & Time
              </label>

              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) =>
                  setExpiresAt(e.target.value)
                }
                className={inputCls}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) =>
                setActive(e.target.checked)
              }
            />
            Active coupon
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveCoupon}
              disabled={saving}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60"
            >
              {saving
                ? "Saving…"
                : editingId
                  ? "Update Coupon"
                  : "Create Coupon"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
function OfficialQuestionManager({
  eventId,
}: {
  eventId: string;
}) {
  const [questions, setQuestions] = useState<OfficialApplicationQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] =
    useState<OfficialApplicationQuestionType>("text");
  const [isRequired, setIsRequired] = useState(true);
  const [choices, setChoices] = useState<string[]>([""]);

  async function loadQuestions() {
    setLoading(true);

    try {
      const data = await getApplicationQuestions(eventId);
      setQuestions(data);
    } catch (error: any) {
      toast.error(error?.message || "Couldn't load questions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuestions();
  }, [eventId]);

  function resetForm() {
    setEditingId(null);
    setQuestionText("");
    setQuestionType("text");
    setIsRequired(true);
    setChoices([""]);
  }

  function startEdit(question: OfficialApplicationQuestion) {
    setEditingId(question.id);
    setQuestionText(question.question_text);
    setQuestionType(question.question_type);
    setIsRequired(question.is_required);

    setChoices(
      question.choices && question.choices.length > 0
        ? question.choices
        : [""]
    );
  }

  function handleTypeChange(
    type: OfficialApplicationQuestionType
  ) {
    setQuestionType(type);

    if (
      type === "single_choice" ||
      type === "multiple_choice"
    ) {
      if (choices.length === 0) {
        setChoices([""]);
      }
    } else {
      setChoices([]);
    }
  }

  async function saveQuestion() {
    if (!questionText.trim()) {
      toast.error("Please enter a question.");
      return;
    }

    const needsChoices =
      questionType === "single_choice" ||
      questionType === "multiple_choice";

    const cleanChoices = choices
      .map((choice) => choice.trim())
      .filter(Boolean);

    if (needsChoices && cleanChoices.length === 0) {
      toast.error("Please add at least one choice.");
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        await updateApplicationQuestion({
          questionId: editingId,
          questionText: questionText.trim(),
          questionType,
          choices: needsChoices ? cleanChoices : null,
          isRequired,
          sortOrder:
            questions.find((q) => q.id === editingId)?.sort_order ?? 0,
        });

        toast.success("Question updated");
      } else {
        await createApplicationQuestion({
          eventId,
          questionText: questionText.trim(),
          questionType,
          choices: needsChoices ? cleanChoices : null,
          isRequired,
          sortOrder: questions.length,
        });

        toast.success("Question added");
      }

      resetForm();
      await loadQuestions();
    } catch (error: any) {
      toast.error(error?.message || "Couldn't save question");
    } finally {
      setSaving(false);
    }
  }

  async function removeQuestion(question: OfficialApplicationQuestion) {
    if (!confirm(`Delete "${question.question_text}"?`)) {
      return;
    }

    try {
      await deleteApplicationQuestion(question.id);

      toast.success("Question deleted");

      if (editingId === question.id) {
        resetForm();
      }

      await loadQuestions();
    } catch (error: any) {
      toast.error(error?.message || "Couldn't delete question");
    }
  }

  function addChoice() {
    setChoices((prev) => [...prev, ""]);
  }

  function updateChoice(index: number, value: string) {
    setChoices((prev) =>
      prev.map((choice, i) =>
        i === index ? value : choice
      )
    );
  }

  function removeChoice(index: number) {
    setChoices((prev) =>
      prev.filter((_, i) => i !== index)
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/20 p-4">
      <div className="mb-4">
        <h3 className="font-semibold">Application Questions</h3>
        <p className="text-xs text-muted-foreground">
          These questions will be shown to users when they apply
          for this event.
        </p>
      </div>

      {loading ? (
        <div className="py-4 text-center text-sm text-muted-foreground">
          Loading questions…
        </div>
      ) : (
        <div className="space-y-2">
          {questions.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No questions added yet.
            </div>
          )}

          {questions.map((question, index) => (
            <div
              key={question.id}
              className="rounded-lg border border-border bg-background p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {index + 1}. {question.question_text}
                  </div>

                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {question.question_type.replace("_", " ")}
                    {" · "}
                    {question.is_required
                      ? "Required"
                      : "Optional"}
                  </div>

                  {question.choices &&
                    question.choices.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {question.choices.map((choice) => (
                          <div
                            key={choice}
                            className="text-xs text-muted-foreground"
                          >
                            • {choice}
                          </div>
                        ))}
                      </div>
                    )}
                </div>

                <div className="flex shrink-0 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => startEdit(question)}
                    className="underline"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => removeQuestion(question)}
                    className="text-destructive underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-xl border border-border bg-background p-4">
        <div className="mb-3">
          <h4 className="text-sm font-semibold">
            {editingId ? "Edit Question" : "Add Question"}
          </h4>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">
              Question
            </label>

            <input
              value={questionText}
              onChange={(e) =>
                setQuestionText(e.target.value)
              }
              placeholder="e.g. Why do you want to join this event?"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium">
              Answer Type
            </label>

            <select
              value={questionType}
              onChange={(e) =>
                handleTypeChange(
                  e.target.value as OfficialApplicationQuestionType
                )
              }
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none"
            >
              <option value="text">
                Short text
              </option>

              <option value="textarea">
                Long text
              </option>

              <option value="single_choice">
                Single choice
              </option>

              <option value="multiple_choice">
                Multiple choice
              </option>
            </select>
          </div>

          {(questionType === "single_choice" ||
            questionType === "multiple_choice") && (
            <div>
              <label className="text-xs font-medium">
                Choices
              </label>

              <div className="mt-1.5 space-y-2">
                {choices.map((choice, index) => (
                  <div
                    key={index}
                    className="flex gap-2"
                  >
                    <input
                      value={choice}
                      onChange={(e) =>
                        updateChoice(
                          index,
                          e.target.value
                        )
                      }
                      placeholder={`Choice ${index + 1}`}
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        removeChoice(index)
                      }
                      disabled={choices.length === 1}
                      className="rounded-lg border border-border px-3 text-xs disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addChoice}
                  className="text-xs font-semibold underline"
                >
                  + Add choice
                </button>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) =>
                setIsRequired(e.target.checked)
              }
            />
            Required question
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveQuestion}
              disabled={saving}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60"
            >
              {saving
                ? "Saving…"
                : editingId
                  ? "Update Question"
                  : "Add Question"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
function Thumb({ path }: { path: string | null }) {
  const [url, setUrl] = useState("");
  useEffect(() => { let a = true; resolveOfficialMedia(path).then((u) => a && setUrl(u)).catch(() => {}); return () => { a = false; }; }, [path]);
  return <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">{url && <img src={url} alt="" className="h-full w-full object-cover" />}</div>;
}

function OfficialForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: Form;
  onSaved: (input: OfficialEventInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [f, setF] = useState<Form>(initial);
  const [busy, setBusy] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [ticketCropFile, setTicketCropFile] = useState<File | null>(null);
  const [ticketAspect, setTicketAspect] = useState<number>(9 / 16);
const [coverPreview, setCoverPreview] = useState("");
  const [ticketPreview, setTicketPreview] = useState("");
  const set = (k: keyof Form, v: any) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    let alive = true;
    resolveOfficialMedia(f.cover_url).then((u) => alive && setCoverPreview(u)).catch(() => {});
    return () => { alive = false; };
  }, [f.cover_url]);

  useEffect(() => {
    let alive = true;
    resolveOfficialMedia(f.ticket_bg_url).then((u) => alive && setTicketPreview(u)).catch(() => {});
    return () => { alive = false; };
  }, [f.ticket_bg_url]);

  async function pick(key: "cover_url" | "organizer_logo" | "ticket_bg_url", file?: File | null) {
    if (!file) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const path = await uploadOfficialMedia(user.id, file);
      set(key, path);
      toast.success("Image uploaded");
    } catch (e: any) { toast.error(e.message ?? "Upload failed"); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.date) { toast.error("Pick a date"); return; }
    setBusy(true);
    try {
      await onSaved({
        title: f.title.trim(),
        category: f.category,
        description: f.description.trim() || null,
        cover_url: f.cover_url.trim() || null,
        ticket_bg_url: f.ticket_bg_url.trim() || null,
        starts_at: new Date(`${f.date}T${f.time || "19:00"}`).toISOString(),
        venue: f.venue.trim(),
        city: f.city.trim(),
        price_text: f.price_text.trim() || null,
        ends_at: f.end_time ? new Date(`${f.date}T${f.end_time}`).toISOString() : null,
        pass_price: f.pass_price.trim() ? Number(f.pass_price) : null,
        pass_quantity: f.pass_quantity.trim() ? Number(f.pass_quantity) : null,
        pass_info: f.pass_info.trim() || null,
        contact_phone: f.contact_phone.trim() || null,
        instructions: f.instructions.trim() || null,
        organizer_name: f.organizer_name.trim(),
        organizer_logo: f.organizer_logo.trim() || null,
        booking_whatsapp: f.booking_whatsapp.trim() || null,
        ticket_url: f.ticket_url.trim() || null,
        terms: f.terms.trim() || null,
        published: f.published,
        is_featured: f.is_featured,
        is_pinned: f.is_pinned,
        booking_type: f.booking_type,
        organiser_user_id: f.organiser_user_id.trim() || null,
        selection_payment_deadline_minutes:
          Number(f.selection_payment_deadline_minutes) || 30,
        razorpay_enabled: f.razorpay_enabled
      });
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
      <Field label="Event name"><input required value={f.title} onChange={(e) => set("title", e.target.value)} className={inputCls} /></Field>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Category">
          <select value={f.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
            {OFFICIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Booking Type">
  <select
    value={f.booking_type}
    onChange={(e) =>
      set(
        "booking_type",
        e.target.value as "instant" | "selection"
      )
    }
    className={inputCls}
  >
    <option value="instant">Instant Booking</option>
    <option value="selection">Selection Required</option>
  </select>
</Field>

{f.booking_type === "selection" && (
  <Field label="Payment deadline after selection">
    <select
      value={f.selection_payment_deadline_minutes}
      onChange={(e) =>
        set(
          "selection_payment_deadline_minutes",
          e.target.value
        )
      }
      className={inputCls}
    >
      <option value="15">15 minutes</option>
      <option value="30">30 minutes</option>
      <option value="60">1 hour</option>
      <option value="120">2 hours</option>
      <option value="1440">24 hours</option>
    </select>
  </Field>
)} 
        <Field label="Price / pass price"><input value={f.price_text} onChange={(e) => set("price_text", e.target.value)} placeholder="₹499 onwards" className={inputCls} /></Field>
        <Field label="Date"><input required type="date" value={f.date} onChange={(e) => set("date", e.target.value)} className={inputCls} /></Field>
        <Field label="Start time"><input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} className={inputCls} /></Field>
        <Field label="End time (optional)"><input type="time" value={f.end_time} onChange={(e) => set("end_time", e.target.value)} className={inputCls} /></Field>
        <Field label="Venue"><input value={f.venue} onChange={(e) => set("venue", e.target.value)} className={inputCls} /></Field>
        <Field label="City"><input value={f.city} onChange={(e) => set("city", e.target.value)} className={inputCls} /></Field>
        <Field label="Organizer name"><input value={f.organizer_name} onChange={(e) => set("organizer_name", e.target.value)} className={inputCls} /></Field>
        <Field label="Pass price (₹)"><input type="number" min="0" value={f.pass_price} onChange={(e) => set("pass_price", e.target.value)} className={inputCls} /></Field>
        <Field label="Passes available"><input type="number" min="0" value={f.pass_quantity} onChange={(e) => set("pass_quantity", e.target.value)} className={inputCls} /></Field>
        <Field label="Event contact number"><input value={f.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} className={inputCls} /></Field>
        <Field label="WhatsApp booking number"><input value={f.booking_whatsapp} onChange={(e) => set("booking_whatsapp", e.target.value)} placeholder="Leave blank to use default" className={inputCls} /></Field>
      </div>

      <Field label="Cover / banner">
        <div className="overflow-hidden rounded-xl border border-border bg-muted aspect-[16/10] w-full max-w-sm">
          {coverPreview ? (
            <img src={coverPreview} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">No cover yet</div>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) setCropFile(file); e.target.value = ""; }}
            className="text-xs"
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">You can zoom, drag and crop the banner after picking a file.</p>
        <input value={f.cover_url} onChange={(e) => set("cover_url", e.target.value)} placeholder="or paste an image URL" className={`${inputCls} mt-1`} />
        {cropFile && (
          <PhotoCropModal
            file={cropFile}
            aspect={16 / 10}
            round={false}
            size={1440}
            title="Crop the event banner"
            onCancel={() => setCropFile(null)}
            onConfirm={async (cropped) => { setCropFile(null); await pick("cover_url", cropped); }}
          />
        )}
      </Field>
<Field label="Ticket background image">
  <div className="overflow-hidden rounded-xl border border-border bg-muted aspect-[9/16] w-full max-w-[220px]">
    {ticketPreview ? (
      <img src={ticketPreview} alt="" className="h-full w-full object-cover" />
    ) : (
      <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">No ticket background yet</div>
    )}
  </div>
  <div className="mt-2">
    <label className="text-xs font-medium">Aspect ratio for crop</label>
    <select
      value={ticketAspect}
      onChange={(e) => setTicketAspect(Number(e.target.value))}
      className={`${inputCls} mt-1`}
    >
      <option value={9 / 16}>9:16 (Portrait ticket)</option>
      <option value={5 / 4}>5:4</option>
      <option value={7 / 5}>7:5</option>
      <option value={4 / 3}>4:3</option>
      <option value={5 / 3}>5:3</option>
      <option value={3 / 2}>3:2</option>
    </select>
  </div>
  <div className="mt-2 flex items-center gap-2">
    <input
      type="file"
      accept="image/*"
      onChange={(e) => { const file = e.target.files?.[0]; if (file) setTicketCropFile(file); e.target.value = ""; }}
      className="text-xs"
    />
  </div>
  <p className="mt-1 text-[11px] text-muted-foreground">This image appears behind the ticket details when a user downloads their pass.</p>
  <input value={f.ticket_bg_url} onChange={(e) => set("ticket_bg_url", e.target.value)} placeholder="or paste an image URL" className={`${inputCls} mt-1`} />
  {ticketCropFile && (
    <PhotoCropModal
      file={ticketCropFile}
      aspect={ticketAspect}
      round={false}
      size={1440}
      title="Crop the ticket background"
      onCancel={() => setTicketCropFile(null)}
      onConfirm={async (cropped) => { setTicketCropFile(null); await pick("ticket_bg_url", cropped); }}
    />
  )}
</Field>

      <Field label="Organizer logo (optional)">
        <input type="file" accept="image/*" onChange={(e) => pick("organizer_logo", e.target.files?.[0])} className="text-xs" />
        <input value={f.organizer_logo} onChange={(e) => set("organizer_logo", e.target.value)} placeholder="or paste an image URL" className={`${inputCls} mt-1`} />
      </Field>

      <Field label="Ticket booking URL (optional)"><input value={f.ticket_url} onChange={(e) => set("ticket_url", e.target.value)} className={inputCls} /></Field>
      <Field label="Description"><textarea rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} className={inputCls} /></Field>
      <Field label="Pass / ticket information"><textarea rows={2} value={f.pass_info} onChange={(e) => set("pass_info", e.target.value)} className={inputCls} /></Field>
      <Field label="Event instructions"><textarea rows={2} value={f.instructions} onChange={(e) => set("instructions", e.target.value)} className={inputCls} /></Field>
      <Field label="Terms / information"><textarea rows={3} value={f.terms} onChange={(e) => set("terms", e.target.value)} className={inputCls} /></Field>

      <div className="flex flex-wrap gap-4 text-xs">
        <Check label="Published" checked={f.published} onChange={(v) => set("published", v)} />
        <Check label="Featured" checked={f.is_featured} onChange={(v) => set("is_featured", v)} />
        <Check label="Pinned (top of feed)" checked={f.is_pinned} onChange={(v) => set("is_pinned", v)} />
      </div>

      <div className="flex gap-2">
        <button disabled={busy} className="rounded-lg bg-foreground px-4 py-2 text-sm text-background disabled:opacity-60">{busy ? "Saving…" : "Save event"}</button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
      </div>
    </form>
  );
}

const inputCls = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs">{label}{children}</label>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
function OfficialApplicationsManager({ eventId }: { eventId: string }) {
  const [applications, setApplications] = useState<OfficialApplication[]>([]);
  const [questions, setQuestions] = useState<OfficialApplicationQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [orgLink, setOrgLink] = useState<string | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [apps, qs] = await Promise.all([
        listOfficialApplications(eventId),
        getApplicationQuestions(eventId),
      ]);
      setApplications(apps);
      setQuestions(qs);
    } catch (error: any) {
      toast.error(error?.message || "Couldn't load applications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [eventId]);

  async function handleAccept(app: OfficialApplication) {
    setBusyId(app.id);
    try {
      await acceptApplication(app.id);
      toast.success("Application accepted");
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || "Couldn't accept");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(app: OfficialApplication) {
    setBusyId(app.id);
    try {
      await rejectApplication({
        applicationId: app.id,
        rejectionReason: rejectReason.trim() || undefined,
      });
      toast.success("Application rejected");
      setRejectingId(null);
      setRejectReason("");
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || "Couldn't reject");
    } finally {
      setBusyId(null);
    }
  }

  async function handleGenerateOrgLink() {
    setOrgLoading(true);
    try {
      const result = await generateOrganiserLink(eventId);
      setOrgLink(result.url);
      await navigator.clipboard.writeText(result.url);
      toast.success("Organiser link copied to clipboard");
    } catch (error: any) {
      toast.error(error?.message || "Couldn't generate link");
    } finally {
      setOrgLoading(false);
    }
  }

  function answerFor(app: OfficialApplication, questionId: string) {
    const val = app.answers?.[questionId];
    if (!val) return "—";
    return Array.isArray(val) ? val.join(", ") : val;
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/20 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Applications</h3>
          <p className="text-xs text-muted-foreground">
            Review applicant answers, accept or reject.
          </p>
        </div>
        <button
          onClick={handleGenerateOrgLink}
          disabled={orgLoading}
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
        >
          {orgLoading ? "…" : orgLink ? "Copy organiser link" : "Generate organiser link"}
        </button>
      </div>

      {loading ? (
        <div className="py-4 text-center text-sm text-muted-foreground">
          Loading applications…
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          No applications yet.
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <div
              key={app.id}
              className="rounded-lg border border-border bg-background p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">
                  Applicant: {app.user_id.slice(0, 8)}…
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    app.status === "accepted" ||
                    app.status === "confirmed" ||
                    app.status === "payment_pending"
                      ? "bg-green-500/15 text-green-600"
                      : app.status === "rejected" || app.status === "expired"
                        ? "bg-red-500/15 text-red-600"
                        : "bg-yellow-500/15 text-yellow-600"
                  }`}
                >
                  {app.status}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {questions.map((q) => (
                  <div key={q.id} className="text-xs">
                    <div className="font-medium text-muted-foreground">
                      {q.question_text}
                    </div>
                    <div className="mt-0.5">{answerFor(app, q.id)}</div>
                  </div>
                ))}
              </div>

              {app.status === "pending" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleAccept(app)}
                    disabled={busyId === app.id}
                    className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-60"
                  >
                    Accept
                  </button>
                  {rejectingId === app.id ? (
                    <>
                      <input
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason (optional)"
                        className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none"
                      />
                      <button
                        onClick={() => handleReject(app)}
                        disabled={busyId === app.id}
                        className="rounded-lg border border-destructive px-3 py-1.5 text-xs font-semibold text-destructive disabled:opacity-60"
                      >
                        Confirm reject
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason("");
                        }}
                        className="text-xs underline"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setRejectingId(app.id)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs"
                    >
                      Reject
                    </button>
                  )}
                </div>
              )}

              {app.rejection_reason && (
                <div className="mt-2 text-xs text-red-600">
                  Reason: {app.rejection_reason}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 
