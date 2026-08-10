"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";

export type CreateKitState = {
  error?: string;
} | null;

const RESOURCE_TYPES = ["material", "vehicle", "tool", "equipment"];

export async function createKit(
  _prevState: CreateKitState,
  formData: FormData,
): Promise<CreateKitState> {
  const supabase = await createClient();
  const organizationId = await getActiveOrganizationId(supabase);

  if (!organizationId) {
    return { error: "Tu usuario no pertenece a ninguna organización todavía." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const eventType = String(formData.get("event_type") ?? "").trim();
  const categories = formData.getAll("item_category").map(String);
  const types = formData.getAll("item_type").map(String);
  const quantities = formData.getAll("item_quantity").map(String);

  if (!name) {
    return { error: "El nombre del pack es obligatorio." };
  }

  const items: { resource_category: string | null; resource_type: string; quantity: number }[] = [];

  for (let i = 0; i < types.length; i++) {
    const resourceType = types[i];
    const quantity = Number(quantities[i]);
    const category = categories[i]?.trim() || null;

    if (!resourceType) continue;

    if (!RESOURCE_TYPES.includes(resourceType)) {
      return { error: `Tipo de recurso no válido en la línea ${i + 1}.` };
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { error: `Cantidad no válida en la línea ${i + 1}.` };
    }
    if (["material", "tool", "equipment"].includes(resourceType) && !category) {
      return { error: `Falta la categoría en la línea ${i + 1}.` };
    }

    items.push({ resource_category: category, resource_type: resourceType, quantity });
  }

  if (items.length === 0) {
    return { error: "Añade al menos una línea de material." };
  }

  const { data: kit, error: kitError } = await supabase
    .from("kits")
    .insert({ organization_id: organizationId, name, event_type: eventType || null })
    .select("id")
    .single();

  if (kitError || !kit) {
    return { error: `No se pudo crear el pack: ${kitError?.message}` };
  }

  const { error: itemsError } = await supabase.from("kit_items").insert(
    items.map((item) => ({
      kit_id: kit.id,
      resource_category: item.resource_category,
      resource_type: item.resource_type,
      quantity: item.quantity,
    })),
  );

  if (itemsError) {
    return { error: `No se pudieron guardar las líneas: ${itemsError.message}` };
  }

  revalidatePath("/material/kits");
  return null;
}

export async function deleteKit(kitId: string) {
  const supabase = await createClient();
  await supabase.from("kits").delete().eq("id", kitId);
  revalidatePath("/material/kits");
}
