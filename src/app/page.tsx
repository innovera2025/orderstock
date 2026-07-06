import { DbStatus } from "./db-status";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          ระบบจัดการออเดอร์สินค้า
        </h1>
        <p className="text-base text-zinc-600 dark:text-zinc-400">
          ระบบบันทึกและพิมพ์ใบออเดอร์สินค้าประจำวัน
        </p>
      </div>
      <DbStatus />
    </main>
  );
}
