"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";

export type CreatePersonState = {
  error?: string;
} | null;

export async function createPerson(
  _prevState: CreatePersonState,
  formData: FormData,
): Promise<CreatePersonState> {
  const supabase = await createClient();
  const organizationId = await getActiveOrganizationId(supabase);

  if (!organizationId) {
    return { error: "Tu usuario no pertenece a ninguna organización todavía." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const functions = formData.getAll("functions").map(String).filter(Boolean);

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  const { data: resource, error: resourceError } = await supabase
    .from("resources")
    .insert({
      organization_id: organizationId,
      resource_type: "person",
      name,
      status: "available",
    })
    .select("id")
    .single();

  if (resourceError || !resource) {
    return { error: `No se pudo crear la persona: ${resourceError?.message}` };
  }

  const { error: detailsError } = await supabase.from("people_details").insert({
    resource_id: resource.id,
    phone: phone || null,
    email: email || null,
    functions: functions.length > 0 ? functions : null,
  });

  if (detailsError) {
    return { error: `No se pudieron guardar los detalles: ${detailsError.message}` };
  }

  revalidatePath("/personal");
  return null;
}

export type UpdatePersonState = {
  error?: string;
} | null;

export async function updatePerson(
  resourceId: string,
  _prevState: UpdatePersonState,
  formData: FormData,
): Promise<UpdatePersonState> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const functions = formData.getAll("functions").map(String).filter(Boolean);

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  const supabase = await createClient();

  const { error: resourceError } = await supabase
    .from("resources")
    .update({ name, status })
    .eq("id", resourceId);

  if (resourceError) {
    return { error: `No se pudo guardar: ${resourceError.message}` };
  }

  const { error: detailsError } = await supabase
    .from("people_details")
    .update({
      phone: phone || null,
      email: email || null,
      functions: functions.length > 0 ? functions : null,
    })
    .eq("resource_id", resourceId);

  if (detailsError) {
    return { error: `No se pudo guardar: ${detailsError.message}` };
  }

  revalidatePath("/personal");
  return null;
}
