"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

// Phase 04 — mobile กรอกทีละร้าน (per-shop stepper) sub-state. FULL-VIEWPORT fixed overlay
// (z-50) that covers the topbar AND the bottom tab bar, so the tab bar is "hidden during entry"
// without any shared signal. Pure presentational: every stepper writes through the parent's
// setCell/setNote (the SAME cells/notes state the desktop matrix owns). The sticky save button is
// `type="submit" form="order-sheet-form"` — the ONE shared save path (buildOrderPayload), never a
// separate action (validate-contract E2). data-testids expose the mobile e2e surface (E1).

export interface MobileEntryRow {
  variantId: number;
  printOrder: number;
  rosterOrder: number;
  main: string;
  sub: string;
  value: string;
  filled: boolean;
}

interface OrderMobileEntryProps {
  formId: string;
  shopName: string;
  entryNo: number;
  totalCount: number;
  entryUnits: number;
  isBlank: boolean;
  goodsRows: MobileEntryRow[];
  seasoningRows: MobileEntryRow[];
  note: string;
  pending: boolean;
  canPrev: boolean;
  canNext: boolean;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onInput: (variantId: number, raw: string) => void;
  onStep: (variantId: number, delta: number) => void;
  onNote: (text: string) => void;
  onSaveNext: () => void;
}

function StepperRow({
  row,
  onInput,
  onStep,
}: {
  row: MobileEntryRow;
  onInput: (variantId: number, raw: string) => void;
  onStep: (variantId: number, delta: number) => void;
}) {
  return (
    <div
      className="flex items-center gap-2.5 border-b border-[#EDF1EF] px-3.5 py-2 last:border-b-0"
      style={{ background: row.filled ? "#F1FBF6" : "transparent" }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium text-[var(--text)]">{row.main}</div>
        <div className="text-[11px] text-[var(--text-faint)]">{row.sub}</div>
      </div>
      <button
        type="button"
        aria-label="ลด"
        onClick={() => onStep(row.variantId, -1)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-md)] border-[1.5px] border-[var(--border-strong)] bg-[var(--bg-surface)] text-[19px] text-[var(--text-muted)] active:bg-[var(--bg-sunken)]"
      >
        −
      </button>
      <input
        inputMode="numeric"
        data-testid={`mobile-cell-${row.rosterOrder}-${row.printOrder}`}
        value={row.value}
        onChange={(e) => onInput(row.variantId, e.target.value)}
        className="h-11 w-12 shrink-0 border-none bg-transparent text-center font-[var(--font-mono)] text-[16px] font-semibold text-[var(--text)] outline-none"
      />
      <button
        type="button"
        aria-label="เพิ่ม"
        onClick={() => onStep(row.variantId, 1)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[var(--brand-int)] text-[19px] text-[var(--text-on-brand)] active:bg-[var(--brand-int-hover)]"
      >
        +
      </button>
    </div>
  );
}

export function OrderMobileEntry({
  formId,
  shopName,
  entryNo,
  totalCount,
  entryUnits,
  isBlank,
  goodsRows,
  seasoningRows,
  note,
  pending,
  canPrev,
  canNext,
  onBack,
  onPrev,
  onNext,
  onInput,
  onStep,
  onNote,
  onSaveNext,
}: OrderMobileEntryProps) {
  return (
    <div
      data-testid="mobile-entry"
      className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-app)] md:hidden"
    >
      {/* Top bar: back + shop name + prev/next. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5">
        <button
          type="button"
          onClick={onBack}
          data-testid="mobile-entry-back"
          className="flex h-11 items-center gap-1 rounded-[var(--r-md)] px-2.5 text-[14px] font-semibold text-[#15885B]"
        >
          <ChevronLeft size={16} strokeWidth={2} />
          ร้านค้า
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[15.5px] font-bold text-[var(--text-strong)]">
            {shopName}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            ร้านที่ {entryNo} จาก {totalCount} · รวม {entryUnits} หน่วย
          </div>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="ร้านก่อนหน้า"
            onClick={onPrev}
            disabled={!canPrev}
            className="flex h-11 w-11 items-center justify-center rounded-[var(--r-md)] border-[1.5px] border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-muted)] disabled:opacity-40"
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="ร้านถัดไป"
            onClick={onNext}
            disabled={!canNext}
            className="flex h-11 w-11 items-center justify-center rounded-[var(--r-md)] border-[1.5px] border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-muted)] disabled:opacity-40"
          >
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Scrollable stepper body. */}
      <div className="flex-1 overflow-auto px-3.5 pb-2 pt-3">
        {isBlank ? (
          <div className="pt-10 text-center text-[13px] text-[var(--text-faint)]">
            ช่องว่างในผังร้าน — ไม่มีรายการให้กรอก
          </div>
        ) : (
          <>
            <div className="px-1 pb-2 pt-0.5 text-[11.5px] font-semibold text-[#15885B]">
              สินค้า
            </div>
            <div className="mb-3.5 overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg-surface)]">
              {goodsRows.map((r) => (
                <StepperRow key={r.variantId} row={r} onInput={onInput} onStep={onStep} />
              ))}
            </div>

            <div className="px-1 pb-2 text-[11.5px] font-semibold text-[#B45F09]">เครื่องปรุง</div>
            <div className="mb-3.5 overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg-surface)]">
              {seasoningRows.map((r) => (
                <StepperRow key={r.variantId} row={r} onInput={onInput} onStep={onStep} />
              ))}
            </div>

            <div className="px-1 pb-2 text-[11.5px] font-semibold text-[var(--text-muted)]">
              หมายเหตุ
            </div>
            <div className="mb-4 rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg-surface)] px-3.5">
              <input
                type="text"
                value={note}
                onChange={(e) => onNote(e.target.value)}
                placeholder="เช่น ดีขาว 1/2 กก."
                data-testid="mobile-entry-note"
                className="h-11 w-full border-none bg-transparent text-[14px] text-[var(--text)] outline-none"
              />
            </div>
          </>
        )}
      </div>

      {/* Sticky save — the ONE shared save path (E2). */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-app)] px-3.5 pb-3 pt-2.5">
        <button
          type="submit"
          form={formId}
          data-testid="mobile-save"
          disabled={pending}
          onClick={onSaveNext}
          className="min-h-12 w-full rounded-[var(--r-md)] bg-[var(--brand-int)] text-[15px] font-semibold text-[var(--text-on-brand)] transition-[background,transform] duration-150 active:translate-y-px disabled:opacity-50"
        >
          {pending ? "กำลังบันทึก…" : "บันทึก แล้วไปร้านถัดไป"}
        </button>
      </div>
    </div>
  );
}
