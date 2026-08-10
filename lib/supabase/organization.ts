import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Devuelve el organization_id de la organización activa del usuario autenticado
 * (hoy siempre la única a la que pertenece — sin selector de organización todavía).
 */
export async function getActiveOrganizationId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return membership?.organization_id ?? null;
}
