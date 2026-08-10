"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type UpdateMaterialState = {
  error?: string;
} | null;

const STATUSES = ["available", "in_use", "in_repair", "out_of_service", "retired"];

export async function updateMaterial(
  resourceId: string,
  _prevState: UpdateMaterialState,
  formData: FormData,
): Promise<UpdateMaterialState> {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const serialNumber = String(formData.get("serial_number") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!name || !category) {
    return { error: "Nombre y categoría son obligatorios." };
  }

  if (!STATUSES.includes(status)) {
    return { error: "Estado no válido." };
  }

  const { error: resourceError } = await supabase
    .from("resources")
    .update({ name, status })
    .eq("id", resourceId);

  if (resourceError) {
    return { error: `No se pudo guardar: ${resourceError.message}` };
  }

  const { error: detailsError } = await supabase
    .from("materials_details")
    .update({ category, serial_number: serialNumber || null })
    .eq("resource_id", resourceId);

  if (detailsError) {
    return { error: `No se pudo guardar: ${detailsError.message}` };
  }

  revalidatePath(`/material/${resourceId}`);
  revalidatePath("/material");
  return null;
}
