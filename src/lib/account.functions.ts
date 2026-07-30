import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Changes the phone number the member signs in with. The caller must already
 * have re-verified their password in the browser before calling this.
 */
export const changeMyPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone: string }) => {
    const digits = (input?.phone ?? "").replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
      throw new Error("Enter a valid phone number");
    }
    return { phone: digits };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = `${data.phone}@huddl.local`;

    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      email,
      email_confirm: true,
    });
    if (error) {
      if (`${error.message}`.toLowerCase().includes("already")) {
        throw new Error("That phone number is already registered.");
      }
      throw new Error(error.message);
    }

    await supabaseAdmin
      .from("profiles" as any)
      .update({ phone: data.phone })
      .eq("id", context.userId);

    return { ok: true, phone: data.phone };
  });

/**
 * Permanently deletes the signed-in member's account and all data that
 * cascades from their auth user row.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Content that isn't cascade-deleted from auth.users is removed explicitly.
    await supabaseAdmin.from("posts" as any).delete().eq("user_id", context.userId);
    await supabaseAdmin.from("events" as any).delete().eq("host_id", context.userId);
    await supabaseAdmin.from("profiles" as any).delete().eq("id", context.userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
