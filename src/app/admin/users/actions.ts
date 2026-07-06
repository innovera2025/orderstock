"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, requireAuthState } from "@/lib/auth-guard";
import { hashPassword } from "@/lib/password";
import { ROLES } from "@/lib/product-order";

// Admin user-management server actions. EVERY action is requireAuth("ADMIN") (E8): proxy.ts
// blocks the /admin PAGE, but a STAFF POSTing the raw action must also be rejected here — the
// server guard is the real boundary. E9: never demote/deactivate the LAST active ADMIN.

export interface UserActionState {
  error?: string;
  success?: string;
}

const createSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร")
    .max(100, "ชื่อผู้ใช้ยาวเกินไป"),
  password: z
    .string()
    .min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
    .max(72, "รหัสผ่านยาวเกินไป (สูงสุด 72 ไบต์)"),
  role: z.enum(ROLES, { message: "กรุณาเลือกบทบาท" }),
});

const resetSchema = z.object({
  userId: z.coerce.number().int().positive(),
  password: z
    .string()
    .min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
    .max(72, "รหัสผ่านยาวเกินไป (สูงสุด 72 ไบต์)"),
});

const roleSchema = z.object({
  userId: z.coerce.number().int().positive(),
  role: z.enum(ROLES, { message: "กรุณาเลือกบทบาท" }),
});

// True if `userId` is the ONLY currently-active ADMIN (so demoting/deactivating locks everyone
// out of /admin). E9.
async function isLastActiveAdmin(userId: number): Promise<boolean> {
  const activeAdmins = await prisma.user.findMany({
    where: { role: "ADMIN", active: true },
    select: { id: true },
  });
  return activeAdmins.length === 1 && activeAdmins[0]?.id === userId;
}

export async function createUser(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const denied = await requireAuthState("ADMIN");
  if (denied) return denied;

  const parsed = createSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  const existing = await prisma.user.findUnique({
    where: { username: parsed.data.username },
  });
  if (existing) {
    return { error: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.create({
    data: { username: parsed.data.username, passwordHash, role: parsed.data.role },
  });
  revalidatePath("/admin/users");
  return { success: `สร้างผู้ใช้ ${parsed.data.username} เรียบร้อยแล้ว` };
}

export async function editRole(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const denied = await requireAuthState("ADMIN");
  if (denied) return denied;

  const parsed = roleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) return { error: "ไม่พบผู้ใช้" };

  // E9: block demoting the last active ADMIN.
  if (
    target.role === "ADMIN" &&
    target.active &&
    parsed.data.role !== "ADMIN" &&
    (await isLastActiveAdmin(target.id))
  ) {
    return { error: "ไม่สามารถลดสิทธิ์ผู้ดูแลระบบคนสุดท้ายได้" };
  }

  await prisma.user.update({ where: { id: target.id }, data: { role: parsed.data.role } });
  revalidatePath("/admin/users");
  return { success: "อัปเดตบทบาทเรียบร้อยแล้ว" };
}

export async function resetPassword(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const denied = await requireAuthState("ADMIN");
  if (denied) return denied;

  const parsed = resetSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) return { error: "ไม่พบผู้ใช้" };

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.update({ where: { id: target.id }, data: { passwordHash } });
  revalidatePath("/admin/users");
  return { success: `รีเซ็ตรหัสผ่านของ ${target.username} เรียบร้อยแล้ว` };
}

export async function deactivateUser(userId: number): Promise<void> {
  await requireAuth("ADMIN");
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return;
  // E9: never deactivate the last active ADMIN (would lock everyone out of /admin).
  if (target.role === "ADMIN" && target.active && (await isLastActiveAdmin(userId))) {
    throw new Error("ไม่สามารถระงับผู้ดูแลระบบคนสุดท้ายได้");
  }
  await prisma.user.update({ where: { id: userId }, data: { active: false } });
  revalidatePath("/admin/users");
}

export async function activateUser(userId: number): Promise<void> {
  await requireAuth("ADMIN");
  await prisma.user.update({ where: { id: userId }, data: { active: true } });
  revalidatePath("/admin/users");
}
