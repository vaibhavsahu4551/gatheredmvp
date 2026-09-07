import { supabase } from "@/integrations/supabase/client";

export type OfficialApplicationQuestionType =
  | "text"
  | "textarea"
  | "single_choice"
  | "multiple_choice";

export type OfficialApplicationStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "payment_pending"
  | "confirmed"
  | "expired";

export type OfficialApplicationQuestion = {
  id: string;
  event_id: string;
  question_text: string;
  question_type: OfficialApplicationQuestionType;
  choices: string[] | null;
  is_required: boolean;
  sort_order: number;
  created_at: string;
};

export type OfficialApplicationAnswer = {
  question_id: string;
  answer: string | string[];
};

export type OfficialApplication = {
  id: string;
  event_id: string;
  user_id: string;
  status: OfficialApplicationStatus;
  answers: Record<string, string | string[]>;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  accepted_at: string | null;
  payment_deadline_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SubmitOfficialApplicationInput = {
  eventId: string;
  answers: Record<string, string | string[]>;
};

export type ApplicationDecision = {
  applicationId: string;
  rejectionReason?: string;
};

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("You must be logged in.");

  return user.id;
}

/**
 * Get application questions for an official event.
 */
export async function getApplicationQuestions(
  eventId: string
): Promise<OfficialApplicationQuestion[]> {
  export type CreateOfficialApplicationQuestionInput = {
  eventId: string;
  questionText: string;
  questionType: OfficialApplicationQuestionType;
  choices?: string[] | null;
  isRequired?: boolean;
  sortOrder?: number;
};

export type UpdateOfficialApplicationQuestionInput = {
  questionId: string;
  questionText: string;
  questionType: OfficialApplicationQuestionType;
  choices?: string[] | null;
  isRequired?: boolean;
  sortOrder?: number;
};

export async function createApplicationQuestion(
  input: CreateOfficialApplicationQuestionInput
): Promise<OfficialApplicationQuestion> {
  const { data, error } = await supabase.rpc(
    "admin_create_official_event_application_question",
    {
      p_event_id: input.eventId,
      p_question_text: input.questionText,
      p_question_type: input.questionType,
      p_choices: input.choices ?? null,
      p_is_required: input.isRequired ?? true,
      p_sort_order: input.sortOrder ?? 0,
    }
  );

  if (error) throw error;

  return data as OfficialApplicationQuestion;
}

export async function updateApplicationQuestion(
  input: UpdateOfficialApplicationQuestionInput
): Promise<OfficialApplicationQuestion> {
  const { data, error } = await supabase.rpc(
    "admin_update_official_event_application_question",
    {
      p_question_id: input.questionId,
      p_question_text: input.questionText,
      p_question_type: input.questionType,
      p_choices: input.choices ?? null,
      p_is_required: input.isRequired ?? true,
      p_sort_order: input.sortOrder ?? 0,
    }
  );

  if (error) throw error;

  return data as OfficialApplicationQuestion;
}

export async function deleteApplicationQuestion(
  questionId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc(
    "admin_delete_official_event_application_question",
    {
      p_question_id: questionId,
    }
  );

  if (error) throw error;

  return Boolean(data);
}
  const { data, error } = await supabase
    .from("official_event_application_questions")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return (data ?? []) as OfficialApplicationQuestion[];
}

/**
 * Submit an application for an official event.
 */
export async function submitOfficialApplication(
  input: SubmitOfficialApplicationInput
): Promise<OfficialApplication> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("official_event_applications")
    .insert({
      event_id: input.eventId,
      user_id: userId,
      answers: input.answers,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw error;

  return data as OfficialApplication;
}

/**
 * Get the current user's application for an official event.
 */
export async function getMyApplication(
  eventId: string
): Promise<OfficialApplication | null> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("official_event_applications")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return data as OfficialApplication | null;
}

/**
 * List applications for an official event.
 *
 * This uses a secure database RPC because applicant information
 * should not be exposed directly to the client.
 */
export async function listOfficialApplications(
  eventId: string
): Promise<OfficialApplication[]> {
  const { data, error } = await supabase.rpc(
    "list_official_event_applications",
    {
      p_event_id: eventId,
    }
  );

  if (error) throw error;

  return (data ?? []) as OfficialApplication[];
}

/**
 * Accept an official event application.
 */
export async function acceptApplication(
  applicationId: string
): Promise<OfficialApplication> {
  const { data, error } = await supabase.rpc(
    "accept_official_event_application",
    {
      p_application_id: applicationId,
    }
  );

  if (error) throw error;

  return data as OfficialApplication;
}

/**
 * Reject an official event application.
 */
export async function rejectApplication(
  input: ApplicationDecision
): Promise<OfficialApplication> {
  const { data, error } = await supabase.rpc(
    "reject_official_event_application",
    {
      p_application_id: input.applicationId,
      p_rejection_reason: input.rejectionReason ?? undefined,
    }
  );

  if (error) throw error;

  return data as OfficialApplication;
}

/**
 * Generate a secure organiser review link.
 */
export async function generateOrganiserLink(
  eventId: string
): Promise<{
  token: string;
  url: string;
  expires_at: string | null;
}> {
  const { data, error } = await supabase.rpc(
    "generate_official_event_organiser_link",
    {
      p_event_id: eventId,
    }
  );

  if (error) throw error;

  return data as {
    token: string;
    url: string;
    expires_at: string | null;
  };
}

/**
 * Status helpers
 */
export function isApplicationPending(
  status: OfficialApplicationStatus
) {
  return status === "pending";
}

export function isApplicationAccepted(
  status: OfficialApplicationStatus
) {
  return (
    status === "accepted" ||
    status === "payment_pending" ||
    status === "confirmed"
  );
}

export function isApplicationRejected(
  status: OfficialApplicationStatus
) {
  return status === "rejected";
}

export function isApplicationExpired(
  status: OfficialApplicationStatus
) {
  return status === "expired";
}
