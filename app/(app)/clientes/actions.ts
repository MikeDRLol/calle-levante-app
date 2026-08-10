"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";

export type CreateClientState = {
  error?: string;
} | null;

export async function createClientRecord(
  _prevState: CreateClientState,
  formData: FormData,
): Promise<CreateClientState> {
  const supabase = await createClient();
  const organizationId = await getActiveOrganizationId(supabase);

  if (!organizationId) {
    return { error: "Tu usuario no pertenece a ninguna organización todavía." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  const { error } = await supabase.from("clients").insert({
    organization_id: organizationId,
    name,
    contact_name: contactName || null,
    phone: phone || null,
    email: email || null,
  });

  if (error) {
    return { error: `No se pudo crear el cliente: ${error.message}` };
  }

  revalidatePath("/clientes");
  return null;
}
