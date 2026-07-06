"use client";

// On-screen only (hidden in @media print): the พิมพ์ button + a one-line reminder of the two
// print-dialog settings that matter for a faithful printout. Chrome/Edge only (Chromium engine).
export function PrintControls() {
  return (
    <div className="print-toolbar">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
      >
        พิมพ์
      </button>
      <span className="text-xs text-zinc-500">
        ใช้ Chrome หรือ Edge · ในกล่องพิมพ์ตั้งค่า “ขนาดกระดาษ = A4”, “แนวนอน”, “มาตราส่วน = 100%”
      </span>
    </div>
  );
}
