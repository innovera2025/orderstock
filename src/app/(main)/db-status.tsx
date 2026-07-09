"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "ok" | "error";

/** Client-side DB status indicator that polls the /api/health route once on mount. */
export function DbStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let active = true;
    // Raw browser fetch is relative-to-origin — Next's automatic basePath prefixing applies only
    // to <Link>/useRouter/redirect(), NOT raw fetch(). ENV-CONDITIONAL prefix (unset ⇒ "" ⇒
    // identical to today). This is the ONLY raw client fetch in the app (login/logout are server
    // actions). NEXT_PUBLIC_* is build-time inlined, so build ARG and runtime env must match.
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/health`)
      .then((res) => res.json())
      .then((data: { ok?: boolean }) => {
        if (active) setStatus(data.ok ? "ok" : "error");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const label =
    status === "checking"
      ? "กำลังตรวจสอบการเชื่อมต่อฐานข้อมูล…"
      : status === "ok"
        ? "เชื่อมต่อฐานข้อมูลสำเร็จ"
        : "เชื่อมต่อฐานข้อมูลไม่สำเร็จ";

  const dotColor =
    status === "checking"
      ? "bg-amber-400"
      : status === "ok"
        ? "bg-green-500"
        : "bg-red-500";

  return (
    <div className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm dark:border-white/15">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotColor}`} />
      <span>{label}</span>
    </div>
  );
}
