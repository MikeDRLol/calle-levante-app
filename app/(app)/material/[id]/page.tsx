import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EditMaterialForm } from "@/app/(app)/material/[id]/edit-material-form";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";
import { eventDateFormatter } from "@/lib/utils/format";

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const organizationId = await getActiveOrganizationId(supabase);

  if (!organizationId) {
    notFound();
  }

  const { data: resource } = await supabase
    .from("resources")
    .select("id, name, status, materials_details(category, serial_number)")
    .eq("id", id)
    .maybeSingle();

  if (!resource) {
    notFound();
  }

  const details = resource.materials_details as unknown as {
    category: string | null;
    serial_number: string | null;
  } | null;

  const { data: bookings } = await supabase
    .from("resource_bookings")
    .select("id, start_at, end_at, events(id, name)")
    .eq("resource_id", id)
    .order("start_at", { ascending: false })
    .limit(10);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <Link
          href="/material"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Material
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {resource.name}
        </h1>
      </div>

      <EditMaterialForm
        material={{
          id: resource.id,
          name: resource.name,
          status: resource.status,
          category: details?.category ?? null,
          serial_number: details?.serial_number ?? null,
        }}
      />

      <div className="flex flex-1 flex-col rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Historial de reservas
          </h2>
        </div>

        {!bookings || bookings.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
            Este material no se ha reservado para ningún evento todavía.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {bookings.map((booking) => {
              const event = booking.events as unknown as { id: string; name: string } | null;
              return (
                <li key={booking.id}>
                  <Link
                    href={event ? `/eventos/${event.id}` : "#"}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {event?.name ?? "Evento eliminado"}
                    </span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {eventDateFormatter.format(new Date(booking.start_at))}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
