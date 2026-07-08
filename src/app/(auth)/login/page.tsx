import { LoginForm } from "./login-form";

export const metadata = {
  title: "เข้าสู่ระบบ — ระบบจัดการออเดอร์สินค้า",
};

const MOBILE_HERO_BG =
  "linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px) 0 0/42px 42px," +
  "linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px) 0 0/42px 42px," +
  "linear-gradient(155deg,#0E5238,#082619)";

// Login (Phase 04 responsive): md+ keeps the Phase-02 split-hero (brand panel + credentials card);
// below md it becomes a green gridded hero on top with a white bottom-sheet (radius 18px) holding
// the UNCHANGED LoginForm (name=username/password preserved — auth.spec selectors intact).
export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[var(--bg-app)] md:flex-row">
      {/* Mobile-only gridded green hero (top). */}
      <div
        className="flex flex-1 flex-col justify-end gap-2 p-6 text-white md:hidden"
        style={{ background: MOBILE_HERO_BG }}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-white/15 text-[17px] font-bold">
            ย
          </span>
          <span className="text-[17px] font-bold">
            <span className="text-[#5FCEA4]">ยิ่ง</span>เจริญ
          </span>
        </div>
        <h2 className="mt-2 text-[24px] font-bold leading-[1.4]">
          ระบบใบออเดอร์สินค้า
          <br />
          ประจำวัน
        </h2>
        <p className="text-[13px] text-white/70">สำหรับพนักงานหน้างานและสายส่ง</p>
      </div>

      {/* Desktop-only brand hero (unchanged split-hero left panel). */}
      <div
        className="hidden w-[46%] flex-col justify-between p-12 text-white md:flex"
        style={{ background: "linear-gradient(160deg, var(--brand-int), var(--brand))" }}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[var(--r-lg)] bg-white/15 text-xl font-bold">
            ย
          </span>
          <span className="text-[var(--t-lg)] font-semibold">ระบบจัดการออเดอร์สินค้า</span>
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-[var(--t-2xl)] font-semibold leading-tight">
            บันทึกออเดอร์รายวัน
            <br />
            อย่างเป็นระบบ
          </h2>
          <p className="max-w-xs text-[var(--t-sm)] text-white/80">
            จัดการใบออเดอร์ ร้านค้า และสินค้า พร้อมพิมพ์ใบสรุปรายวันได้ทันที
          </p>
        </div>
        <span className="text-[var(--t-xs)] text-white/60">pguard · orderstock</span>
      </div>

      {/* Credentials — white bottom-sheet on mobile, centered card on desktop. */}
      <div className="-mt-4 flex flex-col items-center gap-6 rounded-t-[18px] bg-[var(--bg-surface)] p-8 md:mt-0 md:flex-1 md:justify-center md:gap-8 md:rounded-none md:bg-transparent">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-[var(--t-2xl)] font-semibold text-[var(--text-strong)]">เข้าสู่ระบบ</h1>
          <p className="text-[var(--t-sm)] text-[var(--text-muted)]">
            กรอกชื่อผู้ใช้และรหัสผ่านเพื่อเข้าใช้งาน
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
