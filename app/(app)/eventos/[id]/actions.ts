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

export type UpdateEventState = {
  error?: string;
} | null;

const EVENT_STATUSES = [
  "draft",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
];

export async function updateEvent(
  eventId: string,
  _prevState: UpdateEventState,
  formData: FormData,
): Promise<UpdateEventState> {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const eventType = String(formData.get("event_type") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const startAt = String(formData.get("start_at") ?? "");
  const endAt = String(formData.get("end_at") ?? "");
  const venueName = String(formData.get("venue_name") ?? "").trim();
  const venueAddress = String(formData.get("venue_address") ?? "").trim();
  const totalAmountRaw = String(formData.get("total_amount") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim();

  if (!name || !eventType || !startAt || !endAt) {
    return { error: "Nombre, tipo y fechas son obligatorios." };
  }

  if (!EVENT_STATUSES.includes(status)) {
    return { error: "Estado no válido." };
  }

  const totalAmount = totalAmountRaw ? Number(totalAmountRaw) : null;
  if (totalAmountRaw && (Number.isNaN(totalAmount) || (totalAmount ?? 0) < 0)) {
    return { error: "El importe no es válido." };
  }

  const { error } = await supabase
    .from("events")
    .update({
      name,
      event_type: eventType,
      status,
      start_at: startAt,
      end_at: endAt,
      venue_name: venueName || null,
      venue_address: venueAddress || null,
      total_amount: totalAmount,
      client_id: clientId || null,
      notes: notes || null,
    })
    .eq("id", eventId);

  if (error) {
    return { error: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath(`/eventos/${eventId}`);
  revalidatePath("/eventos");
  return null;
}

export type AddPaymentState = {
  error?: string;
} | null;

const PAYMENT_METHODS = ["cash", "transfer", "bizum", "card", "other"];

export async function addPayment(
  eventId: string,
  organizationId: string,
  _prevState: AddPaymentState,
  formData: FormData,
): Promise<AddPaymentState> {
  const supabase = await createClient();

  const amountRaw = String(formData.get("amount") ?? "").trim();
  const method = String(formData.get("method") ?? "").trim();
  const paidAt = String(formData.get("paid_at") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const amount = Number(amountRaw);
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
    return { error: "El importe debe ser mayor que 0." };
  }

  if (!PAYMENT_METHODS.includes(method)) {
    return { error: "Método de pago no válido." };
  }

  if (!paidAt) {
    return { error: "La fecha es obligatoria." };
  }

  const { error } = await supabase.from("event_payments").insert({
    organization_id: organizationId,
    event_id: eventId,
    amount,
    method,
    paid_at: paidAt,
    notes: notes || null,
  });

  if (error) {
    return { error: `No se pudo registrar el pago: ${error.message}` };
  }

  revalidatePath(`/eventos/${eventId}`);
  return null;
}

export type AddResourceState = {
  error?: string;
} | null;

export async function addResourceToEvent(
  eventId: string,
  organizationId: string,
  _prevState: AddResourceState,
  formData: FormData,
): Promise<AddResourceState> {
  const resourceId = String(formData.get("resource_id") ?? "").trim();

  if (!resourceId) {
    return { error: "Selecciona un recurso." };
  }

  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("start_at, end_at")
    .eq("id", eventId)
    .single();

  if (!event) {
    return { error: "Evento no encontrado." };
  }

  // Re-comprobar disponibilidad aquí, no solo confiar en lo que se filtró al
  // pintar el selector (ADR-003): entre que se cargó la lista y este submit
  // puede haberse reservado el recurso para otro evento.
  const { data: availability } = await supabase.rpc(
    "fn_check_resource_availability",
    {
      p_resource_ids: [resourceId],
      p_start_at: event.start_at,
      p_end_at: event.end_at,
    },
  );

  if (!availability || !availability[0]?.is_available) {
    return { error: "Ese recurso ya no está disponible para este evento — recarga la página." };
  }

  let { data: bundle } = await supabase
    .from("bundles")
    .select("id")
    .eq("event_id", eventId)
    .is("source_kit_id", null)
    .maybeSingle();

  if (!bundle) {
    const { data: newBundle, error: bundleError } = await supabase
      .from("bundles")
      .insert({ organization_id: organizationId, event_id: eventId })
      .select("id")
      .single();

    if (bundleError || !newBundle) {
      return { error: "No se pudo preparar la asignación de material." };
    }
    bundle = newBundle;
  }

  const { data: booking, error: bookingError } = await supabase
    .from("resource_bookings")
    .insert({
      organization_id: organizationId,
      resource_id: resourceId,
      event_id: eventId,
      start_at: event.start_at,
      end_at: event.end_at,
    })
    .select("id")
    .single();

  if (bookingError || !booking) {
    return {
      error:
        "No se pudo reservar el recurso — puede que se acabe de asignar a otro evento. Recarga e inténtalo de nuevo.",
    };
  }

  const { error: bundleItemError } = await supabase.from("bundle_items").insert({
    bundle_id: bundle.id,
    resource_id: resourceId,
    booking_id: booking.id,
  });

  if (bundleItemError) {
    return { error: `No se pudo completar la asignación: ${bundleItemError.message}` };
  }

  revalidatePath(`/eventos/${eventId}`);
  return null;
}

export async function removeResourceBooking(bookingId: string, eventId: string) {
  const supabase = await createClient();
  await supabase.from("resource_bookings").delete().eq("id", bookingId);
  revalidatePath(`/eventos/${eventId}`);
}

export type AddPersonnelState = {
  error?: string;
} | null;

export async function addPersonnelToEvent(
  eventId: string,
  organizationId: string,
  _prevState: AddPersonnelState,
  formData: FormData,
): Promise<AddPersonnelState> {
  const resourceId = String(formData.get("resource_id") ?? "").trim();

  if (!resourceId) {
    return { error: "Selecciona una persona." };
  }

  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("start_at, end_at")
    .eq("id", eventId)
    .single();

  if (!event) {
    return { error: "Evento no encontrado." };
  }

  const { data: availability } = await supabase.rpc("fn_check_resource_availability", {
    p_resource_ids: [resourceId],
    p_start_at: event.start_at,
    p_end_at: event.end_at,
  });

  if (!availability || !availability[0]?.is_available) {
    return { error: "Esa persona ya no está disponible para este evento — recarga la página." };
  }

  const { error: bookingError } = await supabase.from("resource_bookings").insert({
    organization_id: organizationId,
    resource_id: resourceId,
    event_id: eventId,
    start_at: event.start_at,
    end_at: event.end_at,
  });

  if (bookingError) {
    return {
      error:
        "No se pudo reservar a esa persona — puede que se acabe de asignar a otro evento. Recarga e inténtalo de nuevo.",
    };
  }

  // Entra automáticamente como participante de la liquidación (importe a 0,
  // editable en la sección de Liquidación) — es lo que pedía el usuario:
  // que asignar personal a un evento y añadirlo a la liquidación sea el
  // mismo paso, no dos.
  const { error: participantError } = await supabase.from("event_settlement_participants").insert({
    organization_id: organizationId,
    event_id: eventId,
    resource_id: resourceId,
    amount_owed: 0,
  });

  if (participantError && participantError.code !== "23505") {
    return { error: `Se reservó, pero no se pudo añadir a la liquidación: ${participantError.message}` };
  }

  revalidatePath(`/eventos/${eventId}`);
  return null;
}

export type ApplyKitState = {
  error?: string;
  warning?: string;
} | null;

export async function applyKitToEvent(
  eventId: string,
  _prevState: ApplyKitState,
  formData: FormData,
): Promise<ApplyKitState> {
  const kitId = String(formData.get("kit_id") ?? "").trim();

  if (!kitId) {
    return { error: "Selecciona un pack." };
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("fn_apply_kit_to_event", {
    p_kit_id: kitId,
    p_event_id: eventId,
  });

  if (error) {
    return { error: `No se pudo aplicar el pack: ${error.message}` };
  }

  revalidatePath(`/eventos/${eventId}`);

  if (!rows || rows.length === 0) {
    return { warning: "Este pack no tiene material configurado — no se añadió nada." };
  }

  type ApplyKitRow = {
    resource_category: string | null;
    resource_type: string;
    quantity_requested: number;
    quantity_resolved: number;
  };

  const shortfalls = (rows as ApplyKitRow[]).filter(
    (r) => r.quantity_resolved < r.quantity_requested,
  );

  if (shortfalls.length > 0) {
    const detail = shortfalls
      .map(
        (r) => `${r.resource_category ?? r.resource_type} (${r.quantity_resolved}/${r.quantity_requested})`,
      )
      .join(", ");
    return { warning: `Pack aplicado parcialmente — falta: ${detail}.` };
  }

  return null;
}
