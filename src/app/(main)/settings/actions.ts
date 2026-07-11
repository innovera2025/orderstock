"use server";

import { revalidatePath } from "next/cache";
import { requireAuthState } from "@/lib/auth-guard";
import { setAppSetting } from "@/lib/app-settings";

// Establishment + display settings actions (Phase 02, decision 2). ADMIN-gated via
// requireAuthState (the server guard is the real boundary — proxy.ts gates the PAGE only). These
// write NON-SECRET display values to the AppSetting key/value store.

export interface SettingsActionState {
  error?: string;
  success?: string;
}

/** Save the establishment panel (place name + recorder name/role). */
export async function saveEstablishment(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const denied = await requireAuthState("ADMIN");
  if (denied) return { error: denied.error };

  await setAppSetting("placeName", String(formData.get("placeName") ?? "").trim());
  await setAppSetting("recorderName", String(formData.get("recorderName") ?? "").trim());
  await setAppSetting("recorderRole", String(formData.get("recorderRole") ?? "").trim());

  revalidatePath("/settings");
  return { success: "บันทึกข้อมูลสถานประกอบการแล้ว" };
}

/** Save the display panel (highlight-filled toggle). */
export async function saveDisplay(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const denied = await requireAuthState("ADMIN");
  if (denied) return { error: denied.error };

  const hlFilled = formData.get("hlFilled") === "on" || formData.get("hlFilled") === "true";
  await setAppSetting("hlFilled", hlFilled ? "1" : "0");

  revalidatePath("/settings");
  return { success: "บันทึกการแสดงผลแล้ว" };
}
