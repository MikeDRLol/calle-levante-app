import { PageHeader } from "@/components/ui/page-header";
import { OrgNameForm } from "@/app/(app)/configuracion/org-name-form";
import { PermissionsMatrix, type PermissionRow } from "@/app/(app)/configuracion/permissions-matrix";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const organizationId = await getActiveOrganizationId(supabase);

  if (!organizationId) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="Configuración" description="Ajustes de la aplicación" />
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Tu usuario todavía no pertenece a ninguna organización.
          </p>
        </div>
      </div>
    );
  }

  const [{ data: organization }, { data: permissions }] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", organizationId).single(),
    supabase
      .from("role_permissions")
      .select("id, role, permission_key, allowed")
      .eq("organization_id", organizationId)
      .order("role", { ascending: true }),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-8">
      <PageHeader title="Configuración" description="Ajustes de la aplicación" />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Organización</h2>
        {organization ? (
          <OrgNameForm organizationId={organization.id} name={organization.name} />
        ) : null}
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Permisos por rol
        </h2>
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          Qué puede hacer cada rol dentro de la organización. Cambia al momento, sin tocar código.
        </p>
        <PermissionsMatrix permissions={(permissions ?? []) as PermissionRow[]} />
      </section>
    </div>
  );
}
