"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AddParticipantState = {
  error?: string;
} | null;

export async function addSettlementParticipant(
  eventId: string,
  organizationId: string,
  _prevState: AddParticipantState,
  formData: FormData,
): Promise<AddParticipantState> {
  const resourceId = String(formData.get("resource_id") ?? "").trim();
  const amountRaw = String(formData.get("amount_owed") ?? "").trim();

  if (!resourceId) {
    return { error: "Selecciona una persona." };
  }

  const amount = amountRaw ? Number(amountRaw) : 0;
  if (Number.isNaN(amount)) {
    return { error: "El importe no es válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("event_settlement_participants").insert({
    organization_id: organizationId,
    event_id: eventId,
    resource_id: resourceId,
    amount_owed: amount,
  });

  if (error) {
    return {
      error: error.code === "23505"
        ? "Esa persona ya está en la liquidación de este evento."
        : `No se pudo añadir: ${error.message}`,
    };
  }

  revalidatePath(`/eventos/${eventId}`);
  return null;
}

export async function updateParticipantAmount(
  participantId: string,
  eventId: string,
  amountOwed: number,
) {
  const supabase = await createClient();
  await supabase
    .from("event_settlement_participants")
    .update({ amount_owed: amountOwed })
    .eq("id", participantId);
  revalidatePath(`/eventos/${eventId}`);
}

export async function removeParticipant(participantId: string, eventId: string) {
  const supabase = await createClient();
  await supabase.from("event_settlement_participants").delete().eq("id", participantId);
  revalidatePath(`/eventos/${eventId}`);
}

export type AddExpenseState = {
  error?: string;
} | null;

export async function addExpense(
  eventId: string,
  organizationId: string,
  _prevState: AddExpenseState,
  formData: FormData,
): Promise<AddExpenseState> {
  const description = String(formData.get("description") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const paidByResourceId = String(formData.get("paid_by_resource_id") ?? "").trim();
  const expenseDate = String(formData.get("expense_date") ?? "").trim();

  const amount = Number(amountRaw);
  if (!description) {
    return { error: "La descripción es obligatoria." };
  }
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
    return { error: "El importe debe ser mayor que 0." };
  }
  if (!expenseDate) {
    return { error: "La fecha es obligatoria." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("event_expenses").insert({
    organization_id: organizationId,
    event_id: eventId,
    description,
    amount,
    paid_by_resource_id: paidByResourceId || null,
    expense_date: expenseDate,
  });

  if (error) {
    return { error: `No se pudo añadir el gasto: ${error.message}` };
  }

  revalidatePath(`/eventos/${eventId}`);
  return null;
}

export async function removeExpense(expenseId: string, eventId: string) {
  const supabase = await createClient();
  await supabase.from("event_expenses").delete().eq("id", expenseId);
  revalidatePath(`/eventos/${eventId}`);
}

export async function recalculateSettlement(eventId: string) {
  const supabase = await createClient();
  await supabase.rpc("fn_calculate_event_settlement", { p_event_id: eventId });
  revalidatePath(`/eventos/${eventId}`);
  revalidatePath("/bizums");
  revalidatePath("/liquidaciones");
}

export async function markTransferPaid(transferId: string, eventId: string) {
  const supabase = await createClient();
  await supabase
    .from("settlement_transfers")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", transferId);
  revalidatePath(`/eventos/${eventId}`);
  revalidatePath("/bizums");
  revalidatePath("/liquidaciones");
}
