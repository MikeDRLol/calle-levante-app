"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleChecklistItem(
  itemId: string,
  eventId: string,
  checked: boolean,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("event_checklist_items")
    .update({
      is_checked: checked,
      checked_at: checked ? new Date().toISOString() : null,
      checked_by: checked ? user?.id ?? null : null,
    })
    .eq("id", itemId);

  revalidatePath(`/eventos/${eventId}`);
}

export type AddChecklistItemState = {
  error?: string;
} | null;

export async function addChecklistItem(
  eventId: string,
  organizationId: string,
  _prevState: AddChecklistItemState,
  formData: FormData,
): Promise<AddChecklistItemState> {
  const supabase = await createClient();
  const label = String(formData.get("label") ?? "").trim();

  if (!label) {
    return { error: "El texto del ítem es obligatorio." };
  }

  const { error } = await supabase.from("event_checklist_items").insert({
    organization_id: organizationId,
    event_id: eventId,
    label,
    source: "manual",
  });

  if (error) {
    return { error: `No se pudo añadir el ítem: ${error.message}` };
  }

  revalidatePath(`/eventos/${eventId}`);
  return null;
}
