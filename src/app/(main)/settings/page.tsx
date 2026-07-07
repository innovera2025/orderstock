import { requireAuth } from "@/lib/auth-guard";
import { getAppSettings } from "@/lib/app-settings";
import { SettingsPanels } from "./settings-panels";

// Settings hub (Phase 02). ADMIN-only; server guard is the real boundary. Hosts the establishment
// + display panels and links to the untouched /settings/db connection panel.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAuth("ADMIN");
  const settings = await getAppSettings();

  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <h1 className="mb-6 text-[var(--t-2xl)] font-semibold text-[var(--text-strong)]">
        ตั้งค่าระบบ
      </h1>
      <SettingsPanels settings={settings} />
    </main>
  );
}
