"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type UpdateOrgState = {
  error?: string;
} | null;

export async function updateOrganizationName(
  organizationId: string,
  _prevState: UpdateOrgState,
  formData: FormData,
): Promise<UpdateOrgState> {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ name }).eq("id", organizationId);

  if (error) {
    return { error: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath("/configuracion");
  return null;
}

export async function togglePermission(permissionId: string, allowed: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("role_permissions")
    .update({ allowed })
    .eq("id", permissionId);

  revalidatePath("/configuracion");
  return { error: error?.message };
}
