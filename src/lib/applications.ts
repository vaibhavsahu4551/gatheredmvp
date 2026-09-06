import { supabase } from "@/integrations/supabase/client";

export type BookingType = "instant" | "selection";

export type QuestionType = "text" | "short_answer" | "multiple_choice";

export type ApplicationQuestion = {
  id?: string;
  question_text: string;
  question_type: QuestionType;
  choices: string[];
  is_required: boolean;
  sort_order: number;
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  short_answer: "Short answer",
  text: "Long answer",
  multiple_choice: "Multiple choice",
};

export function emptyQuestion(sort_order: number): ApplicationQuestion {
  return { question_text: "", question_type: "short_answer", choices: [], is_required: true, sort_order };
}

export async function listEventQuestions(eventId: string): Promise<ApplicationQuestion[]> {
  const { data, error } = await supabase
    .from("event_application_questions")
    .select("id, question_text, question_type, choices, is_required, sort_order")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((q) => ({
    id: q.id,
    question_text: q.question_text,
    question_type: q.question_type as QuestionType,
    choices: q.choices ?? [],
    is_required: q.is_required,
    sort_order: q.sort_order,
  }));
}

/** Host-only: replace the question set for an event. */
export async function saveEventQuestions(eventId: string, questions: ApplicationQuestion[]) {
  const { error: delErr } = await supabase
    .from("event_application_questions")
    .delete()
    .eq("event_id", eventId);
  if (delErr) throw delErr;
  const rows = questions
    .map((q, i) => ({
      event_id: eventId,
      question_text: q.question_text.trim(),
      question_type: q.question_type,
      choices: q.question_type === "multiple_choice" ? q.choices.map((c) => c.trim()).filter(Boolean) : [],
      is_required: q.is_required,
      sort_order: i,
    }))
    .filter((q) => q.question_text.length > 0);
  if (!rows.length) return;
  const { error } = await supabase.from("event_application_questions").insert(rows);
  if (error) throw error;
}

/** Returns an error string when the question set isn't ready to save. */
export function validateQuestions(questions: ApplicationQuestion[]): string | null {
  if (!questions.length) return "Add at least one application question";
  for (const q of questions) {
    if (!q.question_text.trim()) return "Every question needs text";
    if (q.question_type === "multiple_choice" && q.choices.filter((c) => c.trim()).length < 2) {
      return "Multiple choice questions need at least 2 options";
    }
  }
  return null;
}
export type ApplicationStatus = "pending" | "accepted" | "rejected" | "payment_pending" | "confirmed";

export type ApplicationAnswer = { question_id: string; question_text: string; answer: string };

export type ApplicationRow = {
  id: string;
  event_id: string;
  user_id: string;
  answers: ApplicationAnswer[];
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
};

/** Applicant: submit answers for a Selection Based event. Creates a "pending" application. */
export async function submitApplication(eventId: string, answers: ApplicationAnswer[]) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const { error } = await supabase.from("event_applications").insert({
    event_id: eventId,
    user_id: user.id,
    answers,
  });
  if (error) throw error;
}

/** Applicant: withdraw a still-pending application. */
export async function cancelApplication(applicationId: string) {
  const { error } = await supabase.from("event_applications").delete().eq("id", applicationId);
  if (error) throw error;
}

/** Applicant: fetch the current user's application for this event, if any. */
export async function getMyApplication(eventId: string): Promise<ApplicationRow | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("event_applications")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ApplicationRow) ?? null;
}

/** Host: fetch every application submitted for this event, oldest first. */
export async function listApplicationsForEvent(eventId: string): Promise<ApplicationRow[]> {
  const { data, error } = await supabase
    .from("event_applications")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ApplicationRow[];
}

/** Host: accept or reject a pending application (RLS + trigger handle the rest). */
export async function respondToApplication(applicationId: string, decision: "accepted" | "rejected") {
  const { error } = await supabase.rpc("respond_event_application", {
    _application_id: applicationId,
    _decision: decision,
  });
  if (error) throw error;
}
