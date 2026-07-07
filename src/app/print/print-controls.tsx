"use client";

import { Button } from "@/components/ui/button";

// On-screen only (hidden in @media print): the พิมพ์ button + a one-line reminder of the two
// print-dialog settings that matter for a faithful printout. Chrome/Edge only (Chromium engine).
// The print SHEET itself (print-table/sheet-header/layout) is untouched — this is toolbar chrome.
export function PrintControls() {
  return (
    <div className="print-toolbar flex items-center gap-3">
      <Button type="button" onClick={() => window.print()}>
        พิมพ์
      </Button>
      <span className="text-[var(--t-xs)] text-[var(--text-muted)]">
        ใช้ Chrome หรือ Edge · ในกล่องพิมพ์ตั้งค่า “ขนาดกระดาษ = A4”, “แนวนอน”, “มาตราส่วน = 100%”
      </span>
    </div>
  );
}
