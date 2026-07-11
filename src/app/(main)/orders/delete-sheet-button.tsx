"use client";

import { useActionState, useState } from "react";
import { softDeleteOrderSheet, type DeleteSheetActionState } from "./actions";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

// First confirm-before-destroy pattern in the codebase (reference implementation for future
// destructive-action confirms). NO native confirm() — uses the pguard Modal primitive. The delete
// submits softDeleteOrderSheet (ADMIN-only, server-enforced). On success, revalidatePath("/orders")
// removes this row (and this whole component) from the server-rendered list, so the modal unmounts
// on its own — no manual close-on-ok effect needed. On error the modal stays open to show the message.
export function DeleteSheetButton({
  sheetId,
  dateLabel,
}: {
  sheetId: number;
  dateLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    softDeleteOrderSheet,
    {} as DeleteSheetActionState,
  );

  return (
    <>
      <Button
        variant="danger-ghost"
        size="sm"
        className="ml-3"
        onClick={() => setOpen(true)}
      >
        ลบ
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy={`del-sheet-${sheetId}`}>
        <h2
          id={`del-sheet-${sheetId}`}
          className="mb-2 text-[var(--t-lg)] font-semibold text-[var(--text-strong)]"
        >
          ลบใบออเดอร์
        </h2>
        <p className="mb-1 text-[var(--t-sm)] text-[var(--text)]">
          ยืนยันลบใบออเดอร์วันที่ {dateLabel}?
        </p>
        <p className="mb-5 text-[var(--t-sm)] text-[var(--text-muted)]">
          ข้อมูลจะถูกซ่อนออกจากรายการ แต่ไม่ถูกลบถาวร (กู้คืนได้เฉพาะที่ฐานข้อมูลโดยตรง)
        </p>

        {state.error && (
          <p className="mb-3 rounded-[var(--r-md)] bg-[var(--danger-bg)] px-3 py-2 text-[var(--t-sm)] text-[var(--danger)]">
            {state.error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            ยกเลิก
          </Button>
          <form action={formAction}>
            <input type="hidden" name="id" value={sheetId} />
            <Button type="submit" variant="danger-ghost" size="sm" disabled={pending}>
              ลบ
            </Button>
          </form>
        </div>
      </Modal>
    </>
  );
}
