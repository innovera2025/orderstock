import { LoginForm } from "./login-form";

export const metadata = {
  title: "เข้าสู่ระบบ — ระบบจัดการออเดอร์สินค้า",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">เข้าสู่ระบบ</h1>
        <p className="text-sm text-zinc-500">ระบบจัดการออเดอร์สินค้า</p>
      </div>
      <LoginForm />
    </main>
  );
}
