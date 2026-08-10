import { PageHeader } from "@/components/ui/page-header";
import { NewPersonForm } from "@/app/(app)/personal/new-person-form";
import { PersonalTable, type PersonRow } from "@/app/(app)/personal/personal-table";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";
import { UserRound } from "lucide-react";

export default async function PersonalPage() {
  const supabase = await createClient();
  const organizationId = await getActiveOrganizationId(supabase);

  const { data: people } = organizationId
    ? await supabase
        .from("resources")
        .select("id, name, status, people_details(phone, email, functions)")
        .eq("resource_type", "person")
        .order("name", { ascending: true })
    : { data: null };

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Personal" description="Técnicos, músicos y comerciales" />

      {!organizationId ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Tu usuario todavía no pertenece a ninguna organización.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {people?.length ?? 0} persona{people?.length === 1 ? "" : "s"}
            </p>
          </div>

          <NewPersonForm />

          {!people || people.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
              <UserRound className="size-6 text-zinc-400" aria-hidden />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Todavía no hay nadie dado de alta. Añade a la primera persona arriba — hasta que no
                exista al menos una, no podrás añadir participantes a ninguna liquidación.
              </p>
            </div>
          ) : (
            <PersonalTable people={people as unknown as PersonRow[]} />
          )}
        </>
      )}
    </div>
  );
}
