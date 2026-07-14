"use client";

import { useActionState, useState } from "react";
import type { LocationActionState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type BoundAction = (
  prev: LocationActionState,
  formData: FormData,
) => Promise<LocationActionState>;

export interface LocationItem {
  name: string;
  renameAction: BoundAction;
  deleteAction: BoundAction;
}

interface LocationsManagerProps {
  createAction: BoundAction;
  items: LocationItem[];
}

// location-management client surface. One add-form + a list of LocationRow subcomponents. Each row
// owns its OWN useActionState calls (rename + delete) — a single component cannot legally call a
// hook a variable number of times inside a loop (React Rules of Hooks), so the per-row split
// mirrors the proven DeleteSheetButton-per-row pattern in orders/page.tsx.
export function LocationsManager({ createAction, items }: LocationsManagerProps) {
  const [createState, createFormAction, creating] = useActionState(
    createAction,
    {} as LocationActionState,
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h2 className="mb-3 text-[var(--t-sm)] font-medium text-[var(--text-muted)]">
          เพิ่มสถานที่ใหม่
        </h2>
        <form action={createFormAction} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-1 flex-col gap-1.5 text-[var(--t-sm)] text-[var(--text)]">
            <span>ชื่อสถานที่</span>
            <Input name="name" maxLength={200} required />
          </label>
          <Button type="submit" disabled={creating}>
            เพิ่ม
          </Button>
        </form>
        {createState.error && (
          <p className="mt-3 rounded-[var(--r-md)] bg-[var(--danger-bg)] px-3 py-2 text-[var(--t-sm)] text-[var(--danger)]">
            {createState.error}
          </p>
        )}
      </section>

      <table className="w-full border-collapse text-[var(--t-sm)]">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
            <th className="py-2 pr-2 font-medium">สถานที่</th>
            <th className="py-2 pr-2 text-right font-medium">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={2} className="py-6 text-center text-[var(--text-faint)]">
                ยังไม่มีสถานที่
              </td>
            </tr>
          )}
          {items.map((item) => (
            <LocationRow key={item.name} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LocationRow({ item }: { item: LocationItem }) {
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [renameState, renameFormAction, renaming] = useActionState(
    item.renameAction,
    {} as LocationActionState,
  );
  const [deleteState, deleteFormAction, deleting] = useActionState(
    item.deleteAction,
    {} as LocationActionState,
  );

  return (
    <tr data-testid={`location-row-${item.name}`} className="border-b border-[var(--border)] align-top">
      <td className="py-2 pr-2 text-[var(--text)]">
        {editing ? (
          <form action={renameFormAction} className="flex flex-wrap items-center gap-2">
            <Input
              name="newName"
              defaultValue={item.name}
              maxLength={200}
              required
              className="max-w-xs"
            />
            <Button type="submit" variant="secondary" size="sm" disabled={renaming}>
              บันทึก
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={renaming}
            >
              ยกเลิก
            </Button>
            {renameState.error && (
              <p className="w-full text-[var(--t-sm)] text-[var(--danger)]">{renameState.error}</p>
            )}
          </form>
        ) : (
          <span>{item.name}</span>
        )}
      </td>
      <td className="py-2 pr-2 text-right">
        {!editing && (
          <>
            <Button
              variant="secondary"
              size="sm"
              className="mr-2"
              onClick={() => setEditing(true)}
            >
              แก้ไข
            </Button>
            <Button variant="danger-ghost" size="sm" onClick={() => setConfirmOpen(true)}>
              ลบ
            </Button>
          </>
        )}

        <Modal
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          labelledBy={`del-location-${item.name}`}
        >
          <h2
            id={`del-location-${item.name}`}
            className="mb-2 text-[var(--t-lg)] font-semibold text-[var(--text-strong)]"
          >
            ลบสถานที่
          </h2>
          <p className="mb-5 text-[var(--t-sm)] text-[var(--text)]">
            ยืนยันลบสถานที่ “{item.name}”?
          </p>

          {deleteState.error && (
            <p className="mb-3 rounded-[var(--r-md)] bg-[var(--danger-bg)] px-3 py-2 text-[var(--t-sm)] text-[var(--danger)]">
              {deleteState.error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              ยกเลิก
            </Button>
            <form action={deleteFormAction}>
              <Button type="submit" variant="danger-ghost" size="sm" disabled={deleting}>
                ลบ
              </Button>
            </form>
          </div>
        </Modal>
      </td>
    </tr>
  );
}
