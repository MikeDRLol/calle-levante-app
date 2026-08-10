"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";

export type CreateMaterialState = {
  error?: string;
} | null;

export async function createMaterial(
  _prevState: CreateMaterialState,
  formData: FormData,
): Promise<CreateMaterialState> {
  const supabase = await createClient();
  const organizationId = await getActiveOrganizationId(supabase);

  if (!organizationId) {
    return { error: "Tu usuario no pertenece a ninguna organización todavía." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const serialNumber = String(formData.get("serial_number") ?? "").trim();

  if (!name || !category) {
    return { error: "Nombre y categoría son obligatorios." };
  }

  const { data: resource, error: resourceError } = await supabase
    .from("resources")
    .insert({
      organization_id: organizationId,
      resource_type: "material",
      name,
      status: "available",
    })
    .select("id")
    .single();

  if (resourceError || !resource) {
    return { error: `No se pudo crear el material: ${resourceError?.message}` };
  }

  const { error: detailsError } = await supabase.from("materials_details").insert({
    resource_id: resource.id,
    category,
    serial_number: serialNumber || null,
  });

  if (detailsError) {
    return { error: `No se pudieron guardar los detalles: ${detailsError.message}` };
  }

  revalidatePath("/material");
  return null;
}
