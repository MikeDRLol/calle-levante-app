"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";

export type CreateEventState = {
  error?: string;
  warning?: string;
} | null;

export async function createEvent(
  _prevState: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sesión no válida." };
  }

  const organizationId = await getActiveOrganizationId(supabase);

  if (!organizationId) {
    return { error: "Tu usuario no pertenece a ninguna organización todavía." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const eventType = String(formData.get("event_type") ?? "").trim();
  const startAt = String(formData.get("start_at") ?? "");
  const endAt = String(formData.get("end_at") ?? "");
  const venueName = String(formData.get("venue_name") ?? "").trim();
  const selectedClientId = String(formData.get("client_id") ?? "").trim();
  const newClientName = String(formData.get("new_client_name") ?? "").trim();
  const totalAmountRaw = String(formData.get("total_amount") ?? "").trim();
  const depositAmountRaw = String(formData.get("deposit_amount") ?? "").trim();
  const depositMethod = String(formData.get("deposit_method") ?? "").trim();
  const depositPaidAt = String(formData.get("deposit_paid_at") ?? "").trim();
  const resourceIds = formData.getAll("resource_ids").map(String).filter(Boolean);

  if (!name || !eventType || !startAt || !endAt) {
    return { error: "Nombre, tipo y fechas son obligatorios." };
  }

  const totalAmount = totalAmountRaw ? Number(totalAmountRaw) : null;
  if (totalAmountRaw && (Number.isNaN(totalAmount) || (totalAmount ?? 0) < 0)) {
    return { error: "El importe total no es válido." };
  }

  const depositAmount = depositAmountRaw ? Number(depositAmountRaw) : null;
  if (depositAmountRaw && (Number.isNaN(depositAmount) || (depositAmount ?? 0) <= 0)) {
    return { error: "El importe de la señal no es válido." };
  }
  if (depositAmount && !depositMethod) {
    return { error: "Selecciona un método de pago para la señal." };
  }

  let clientId: string | null = null;

  if (newClientName) {
    const { data: newClient, error: clientError } = await supabase
      .from("clients")
      .insert({ organization_id: organizationId, name: newClientName })
      .select("id")
      .single();

    if (clientError) {
      return { error: "No se pudo crear el cliente." };
    }
    clientId = newClient.id;
  } else if (selectedClientId) {
    clientId = selectedClientId;
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      organization_id: organizationId,
      client_id: clientId,
      event_type: eventType,
      name,
      start_at: startAt,
      end_at: endAt,
      venue_name: venueName || null,
      total_amount: totalAmount,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (eventError || !event) {
    return { error: `No se pudo crear el evento: ${eventError?.message}` };
  }

  let unavailableCount = 0;

  if (resourceIds.length > 0) {
    const { data: availability } = await supabase.rpc(
      "fn_check_resource_availability",
      { p_resource_ids: resourceIds, p_start_at: startAt, p_end_at: endAt },
    );

    type AvailabilityRow = { resource_id: string; is_available: boolean };
    const availableIds = ((availability ?? []) as AvailabilityRow[])
      .filter((a) => a.is_available)
      .map((a) => a.resource_id);

    unavailableCount = resourceIds.length - availableIds.length;

    if (availableIds.length > 0) {
      const { data: bundle } = await supabase
        .from("bundles")
        .insert({ organization_id: organizationId, event_id: event.id })
        .select("id")
        .single();

      for (const resourceId of availableIds) {
        const { data: booking } = await supabase
          .from("resource_bookings")
          .insert({
            organization_id: organizationId,
            resource_id: resourceId,
            event_id: event.id,
            start_at: startAt,
            end_at: endAt,
          })
          .select("id")
          .maybeSingle();

        if (booking && bundle) {
          await supabase.from("bundle_items").insert({
            bundle_id: bundle.id,
            resource_id: resourceId,
            booking_id: booking.id,
          });
        } else {
          unavailableCount += 1;
        }
      }
    }
  }

  if (depositAmount && depositPaidAt) {
    await supabase.from("event_payments").insert({
      organization_id: organizationId,
      event_id: event.id,
      amount: depositAmount,
      method: depositMethod,
      paid_at: depositPaidAt,
      notes: "Señal inicial",
    });
  }

  revalidatePath("/eventos");

  if (unavailableCount > 0) {
    return {
      warning: `El evento se creó, pero ${unavailableCount} recurso(s) ya no estaban disponibles y no se reservaron. Revisa el evento para añadir alternativas.`,
    };
  }

  return null;
}
