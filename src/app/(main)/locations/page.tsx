import { requireAuth } from "@/lib/auth-guard";
import { getManagedLocations } from "@/lib/locations";
import {
  createLocationAction,
  renameLocationAction,
  deleteLocationAction,
} from "./actions";
import { LocationsManager, type LocationItem } from "./locations-manager";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  // Access: both ADMIN and STAFF (no role arg), same as /shops and /products.
  await requireAuth();

  const locations = await getManagedLocations();

  // Bind each row's name to its rename/delete server action here (a server action cannot receive
  // an arbitrary client-supplied name), same partial-application pattern as shops/[id]/edit/page.tsx.
  const items: LocationItem[] = locations.map((name) => ({
    name,
    renameAction: renameLocationAction.bind(null, name),
    deleteAction: deleteLocationAction.bind(null, name),
  }));

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <h1 className="mb-6 text-[var(--t-2xl)] font-semibold text-[var(--text-strong)]">
        จัดการสถานที่
      </h1>
      <LocationsManager createAction={createLocationAction} items={items} />
    </main>
  );
}
