// Canonical product-variant print-order contract (Phase 02, LOAD-BEARING).
// Phases 04 (order entry) and 05 (printing) consume this. The 20 in-print-order
// variants map to the scanned form's data columns C3–C22 (form-canonical_REF §3).
//
// SQL Server does not support Prisma enums (F1 accepted alternative), so packSize/
// group/role are stored as ASCII String columns. These constants are the single
// source of truth for the allowed values and are enforced at the app layer (zod).

export const PACK_SIZES = ["KG_1", "HALF_KG", "NONE"] as const;
export type PackSize = (typeof PACK_SIZES)[number];

export const PRODUCT_GROUPS = ["GOODS", "SEASONING"] as const;
export type ProductGroup = (typeof PRODUCT_GROUPS)[number];

export const ROLES = ["ADMIN", "STAFF"] as const;
export type Role = (typeof ROLES)[number];

// Thai display labels for the ASCII enum-substitute values (UI label map, F1).
export const PACK_SIZE_LABELS: Record<PackSize, string> = {
  KG_1: "1 กก.",
  HALF_KG: "1/2 กก.",
  NONE: "",
};

export const PRODUCT_GROUP_LABELS: Record<ProductGroup, string> = {
  GOODS: "สินค้า",
  SEASONING: "เครื่องปรุง",
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  STAFF: "พนักงาน",
};

export interface PrintVariant {
  /** Fixed print-order position 1..20 (form columns C3–C22). */
  printOrder: number;
  /** Scanned form column id, for traceability. */
  column: string;
  /** Base product name (canonical intended reading). */
  productName: string;
  group: ProductGroup;
  packSize: PackSize;
  /** Flavor / color / packaging label (หมู, ไก่, น้ำเงิน, (กป), ...) or null. */
  labelVariant: string | null;
  /** Whether the transcribed name is uncertain (pending user confirmation). */
  needsConfirmation: boolean;
}

// The 20 in-order product-variants in fixed print order (form-canonical_REF §3 C3–C22).
// `needsConfirmation` reflects the REF "Items To Confirm" list (ด/ต ambiguity, brand
// readings, (กป) meaning, แบะแซ spelling).
export const PRINT_VARIANTS: readonly PrintVariant[] = [
  { printOrder: 1, column: "C3", productName: "ดีนิ่ม A", group: "GOODS", packSize: "NONE", labelVariant: null, needsConfirmation: true },
  { printOrder: 2, column: "C4", productName: "ตีลานนิ่ม", group: "GOODS", packSize: "KG_1", labelVariant: null, needsConfirmation: true },
  { printOrder: 3, column: "C5", productName: "ตีลานนิ่ม", group: "GOODS", packSize: "HALF_KG", labelVariant: null, needsConfirmation: true },
  { printOrder: 4, column: "C6", productName: "ตีลาน", group: "GOODS", packSize: "KG_1", labelVariant: null, needsConfirmation: true },
  { printOrder: 5, column: "C7", productName: "ตีลาน", group: "GOODS", packSize: "HALF_KG", labelVariant: null, needsConfirmation: true },
  { printOrder: 6, column: "C8", productName: "กรวด", group: "GOODS", packSize: "NONE", labelVariant: null, needsConfirmation: false },
  { printOrder: 7, column: "C9", productName: "กรวดเหลือง", group: "GOODS", packSize: "NONE", labelVariant: null, needsConfirmation: false },
  { printOrder: 8, column: "C10", productName: "รอง", group: "GOODS", packSize: "KG_1", labelVariant: null, needsConfirmation: false },
  { printOrder: 9, column: "C11", productName: "รอง", group: "GOODS", packSize: "HALF_KG", labelVariant: null, needsConfirmation: false },
  { printOrder: 10, column: "C12", productName: "แบะแซ", group: "GOODS", packSize: "KG_1", labelVariant: null, needsConfirmation: true },
  { printOrder: 11, column: "C13", productName: "แบะแซ", group: "GOODS", packSize: "HALF_KG", labelVariant: null, needsConfirmation: true },
  { printOrder: 12, column: "C14", productName: "สารส้ม", group: "GOODS", packSize: "NONE", labelVariant: null, needsConfirmation: false },
  { printOrder: 13, column: "C15", productName: "ปูนแดง", group: "GOODS", packSize: "NONE", labelVariant: null, needsConfirmation: false },
  { printOrder: 14, column: "C16", productName: "ปูนแดง", group: "GOODS", packSize: "NONE", labelVariant: "(กป)", needsConfirmation: true },
  { printOrder: 15, column: "C17", productName: "เลอรส", group: "GOODS", packSize: "NONE", labelVariant: "หมู", needsConfirmation: true },
  { printOrder: 16, column: "C18", productName: "เลอรส", group: "GOODS", packSize: "NONE", labelVariant: "ไก่", needsConfirmation: true },
  { printOrder: 17, column: "C19", productName: "น้ำปลา", group: "SEASONING", packSize: "NONE", labelVariant: "น้ำเงิน", needsConfirmation: false },
  { printOrder: 18, column: "C20", productName: "น้ำตาล", group: "SEASONING", packSize: "NONE", labelVariant: "แดง", needsConfirmation: false },
  { printOrder: 19, column: "C21", productName: "ส้มแว่น", group: "SEASONING", packSize: "NONE", labelVariant: "เขียว", needsConfirmation: false },
  { printOrder: 20, column: "C22", productName: "ส้มบด", group: "SEASONING", packSize: "NONE", labelVariant: "ส้ม", needsConfirmation: false },
] as const;

// Compose the canonical variant display name used for OrderLine/NoteLine name snapshots.
export function variantDisplayName(
  productName: string,
  packSize: PackSize,
  labelVariant: string | null,
): string {
  const parts = [productName];
  if (labelVariant) parts.push(labelVariant);
  if (packSize !== "NONE") parts.push(PACK_SIZE_LABELS[packSize]);
  return parts.join(" ");
}
