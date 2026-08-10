"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type UpdateClientState = {
  error?: string;
} | null;

export async function updateClient(
  clientId: string,
  _prevState: UpdateClientState,
  formData: FormData,
): Promise<UpdateClientState> {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  const { error } = await supabase
    .from("clients")
    .update({
      name,
      contact_name: contactName || null,
      phone: phone || null,
      email: email || null,
      notes: notes || null,
    })
    .eq("id", clientId);

  if (error) {
    return { error: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/clientes");
  return null;
}
