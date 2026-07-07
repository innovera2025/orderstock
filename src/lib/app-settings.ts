import { prisma } from "@/lib/db";

// App-level display settings (Phase 02, decision 2). Persisted in the EXISTING `AppSetting`
// key/value model (zero schema change). These are NON-SECRET establishment/display values only —
// never a credential. `placeName` reflects in the topbar + print header + sidebar.

export const APP_SETTING_KEYS = [
  "placeName",
  "recorderName",
  "recorderRole",
  "hlFilled",
] as const;

export type AppSettingKey = (typeof APP_SETTING_KEYS)[number];

export interface AppSettings {
  placeName: string;
  recorderName: string;
  recorderRole: string;
  /** "1" = highlight filled matrix cells (display toggle). */
  hlFilled: string;
}

const DEFAULTS: AppSettings = {
  placeName: "",
  recorderName: "",
  recorderRole: "",
  hlFilled: "1",
};

/** Read all app-display settings, falling back to defaults for any key not yet stored. */
export async function getAppSettings(): Promise<AppSettings> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: [...APP_SETTING_KEYS] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    placeName: map.get("placeName") ?? DEFAULTS.placeName,
    recorderName: map.get("recorderName") ?? DEFAULTS.recorderName,
    recorderRole: map.get("recorderRole") ?? DEFAULTS.recorderRole,
    hlFilled: map.get("hlFilled") ?? DEFAULTS.hlFilled,
  };
}

/** Read a single app-display setting (default-backed). */
export async function getAppSetting(key: AppSettingKey): Promise<string> {
  const all = await getAppSettings();
  return all[key];
}

/** Upsert one app-display setting by key. */
export async function setAppSetting(key: AppSettingKey, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
