import { LoginForm } from "./login-form";

export const metadata = {
  title: "เข้าสู่ระบบ — ระบบจัดการออเดอร์สินค้า",
};

// Split-hero login: brand-gradient panel (left, desktop) + credentials card (right).
export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-1 bg-[var(--bg-app)]">
      {/* Brand hero — hidden on small screens. */}
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

      {/* Credentials. */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
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
