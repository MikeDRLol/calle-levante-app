"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";

export type CreateEventState = {
  error?: string;
} | null;

export async function createEvent(
  _prevState: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sesión no válida." };
  }

  const organizationId = await getActiveOrganizationId(supabase);

  if (!organizationId) {
    return { error: "Tu usuario no pertenece a ninguna organización todavía." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const eventType = String(formData.get("event_type") ?? "").trim();
  const startAt = String(formData.get("start_at") ?? "");
  const endAt = String(formData.get("end_at") ?? "");
  const venueName = String(formData.get("venue_name") ?? "").trim();
  const clientName = String(formData.get("client_name") ?? "").trim();

  if (!name || !eventType || !startAt || !endAt) {
    return { error: "Nombre, tipo y fechas son obligatorios." };
  }

  let clientId: string | null = null;

  if (clientName) {
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("name", clientName)
      .limit(1)
      .maybeSingle();

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({ organization_id: organizationId, name: clientName })
        .select("id")
        .single();

      if (clientError) {
        return { error: "No se pudo crear el cliente." };
      }
      clientId = newClient.id;
    }
  }

  const { error: eventError } = await supabase.from("events").insert({
    organization_id: organizationId,
    client_id: clientId,
    event_type: eventType,
    name,
    start_at: startAt,
    end_at: endAt,
    venue_name: venueName || null,
    created_by: user.id,
  });

  if (eventError) {
    return { error: `No se pudo crear el evento: ${eventError.message}` };
  }

  revalidatePath("/eventos");
  return null;
}
