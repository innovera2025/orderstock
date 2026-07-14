"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuthState } from "@/lib/auth-guard";
import {
  getManagedLocations,
  setManagedLocations,
  addLocation,
  renameLocation,
  removeLocation,
} from "@/lib/locations";
import { LOCATIONS_KEY, normalizeLocations } from "@/lib/locations-core";

// location-management server actions. Guarded by requireAuthState() (no role arg → ADMIN + STAFF,
// same access level as /shops and /products). All list writes go through the pure transforms +
// setManagedLocations() (which normalizes + upserts the single AppSetting row). No redirect —
// actions stay on /locations and rely on revalidatePath to refresh the list.

export interface LocationActionState {
  error?: string;
}

const nameSchema = z
  .string()
  .trim()
  .min(1, "กรุณากรอกชื่อสถานที่")
  .max(200, "ชื่อสถานที่ยาวเกินไป");

export async function createLocationAction(
  _prev: LocationActionState,
  formData: FormData,
): Promise<LocationActionState> {
  const denied = await requireAuthState();
  if (denied) return denied;

  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  const list = await getManagedLocations();
  // Duplicate feedback: addLocation silently dedupes, so an already-present name would no-op with
  // zero feedback. Surface it instead (case-sensitive exact match — same semantics as
  // normalizeLocations/roster.ts). The list from getManagedLocations() is already normalized.
  if (list.includes(parsed.data)) {
    return { error: "มีสถานที่นี้อยู่แล้ว" };
  }

  await setManagedLocations(addLocation(list, parsed.data));
  revalidatePath("/locations");
  return {};
}

export async function renameLocationAction(
  oldName: string,
  _prev: LocationActionState,
  formData: FormData,
): Promise<LocationActionState> {
  const denied = await requireAuthState();
  if (denied) return denied;

  const parsed = nameSchema.safeParse(formData.get("newName"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }
  const newName = parsed.data;

  // Update the managed list AND cascade to every Shop.location currently set to the old name — both
  // in ONE $transaction so a mid-failure can never diverge the managed list from the Shop rows.
  // (The array form of prisma.$transaction is the proven pattern already used by shops/actions.ts.)
  const list = await getManagedLocations();
  const renamedValue = JSON.stringify(normalizeLocations(renameLocation(list, oldName, newName)));

  try {
    await prisma.$transaction([
      prisma.appSetting.upsert({
        where: { key: LOCATIONS_KEY },
        create: { key: LOCATIONS_KEY, value: renamedValue },
        update: { value: renamedValue },
      }),
      prisma.shop.updateMany({
        where: { location: oldName },
        data: { location: newName },
      }),
    ]);
  } catch {
    return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };
  }

  revalidatePath("/locations");
  revalidatePath("/shops");
  revalidatePath("/orders");
  return {};
}

export async function deleteLocationAction(
  name: string,
  prev: LocationActionState,
  formData: FormData,
): Promise<LocationActionState> {
  void prev;
  void formData; // delete is name-bound only; the confirm form carries no fields.
  const denied = await requireAuthState();
  if (denied) return denied;

  // Delete guard: block while ANY shop (active OR soft-deleted) still references this location.
  // Counting soft-deleted shops too prevents a "ghost" location that a restore would resurrect
  // after the managed-list entry is gone.
  const count = await prisma.shop.count({ where: { location: name } });
  if (count > 0) {
    return { error: `ยังมีร้านค้าใช้สถานที่นี้อยู่ (${count} ร้าน) — ย้ายก่อนลบ` };
  }

  const list = await getManagedLocations();
  await setManagedLocations(removeLocation(list, name));
  revalidatePath("/locations");
  return {};
}
