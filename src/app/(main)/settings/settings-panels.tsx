"use client";

import { useActionState, useState } from "react";
import {
  saveEstablishment,
  saveDisplay,
  type SettingsActionState,
} from "./actions";
import type { AppSettings } from "@/lib/app-settings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

// Establishment + display settings panels (Phase 02).
export function SettingsPanels({ settings }: { settings: AppSettings }) {
  const [estState, estAction, estPending] = useActionState(
    saveEstablishment,
    {} as SettingsActionState,
  );
  const [dispState, dispAction, dispPending] = useActionState(
    saveDisplay,
    {} as SettingsActionState,
  );
  const [hlFilled, setHlFilled] = useState(settings.hlFilled !== "0");

  return (
    <div className="flex flex-col gap-6">
      {/* Establishment. */}
      <Card className="p-5">
        <h2 className="mb-1 text-[var(--t-lg)] font-semibold text-[var(--text-strong)]">
          ข้อมูลสถานประกอบการ
        </h2>
        <p className="mb-4 text-[var(--t-sm)] text-[var(--text-muted)]">
          ชื่อสถานที่จะแสดงบนแถบด้านบนและหัวใบพิมพ์
        </p>
        <form action={estAction} className="flex flex-col gap-4">
          {estState.error && (
            <p className="rounded-[var(--r-md)] bg-[var(--danger-bg)] px-3 py-2 text-[var(--t-sm)] text-[var(--danger)]">
              {estState.error}
            </p>
          )}
          {estState.success && (
            <p className="rounded-[var(--r-md)] bg-[var(--success-bg)] px-3 py-2 text-[var(--t-sm)] text-[var(--success)]">
              {estState.success}
            </p>
          )}
          <label className="flex flex-col gap-1.5 text-[var(--t-sm)] text-[var(--text)]">
            <span>ชื่อสถานที่</span>
            <Input name="placeName" defaultValue={settings.placeName} placeholder="เช่น ครัวกลาง" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[var(--t-sm)] text-[var(--text)]">
              <span>ชื่อผู้บันทึก</span>
              <Input name="recorderName" defaultValue={settings.recorderName} />
            </label>
            <label className="flex flex-col gap-1.5 text-[var(--t-sm)] text-[var(--text)]">
              <span>ตำแหน่งผู้บันทึก</span>
              <Input name="recorderRole" defaultValue={settings.recorderRole} />
            </label>
          </div>
          <div>
            <Button type="submit" disabled={estPending}>
              บันทึก
            </Button>
          </div>
        </form>
      </Card>

      {/* Display. */}
      <Card className="p-5">
        <h2 className="mb-1 text-[var(--t-lg)] font-semibold text-[var(--text-strong)]">
          การแสดงผล
        </h2>
        <p className="mb-4 text-[var(--t-sm)] text-[var(--text-muted)]">
          ปรับการแสดงผลของตารางออเดอร์
        </p>
        <form action={dispAction} className="flex flex-col gap-4">
          {dispState.error && (
            <p className="rounded-[var(--r-md)] bg-[var(--danger-bg)] px-3 py-2 text-[var(--t-sm)] text-[var(--danger)]">
              {dispState.error}
            </p>
          )}
          {dispState.success && (
            <p className="rounded-[var(--r-md)] bg-[var(--success-bg)] px-3 py-2 text-[var(--t-sm)] text-[var(--success)]">
              {dispState.success}
            </p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[var(--t-sm)] text-[var(--text)]">เน้นช่องที่กรอกในตาราง</span>
            <Switch
              checked={hlFilled}
              onCheckedChange={setHlFilled}
              aria-label="เน้นช่องที่กรอก"
            />
          </div>
          <input type="hidden" name="hlFilled" value={hlFilled ? "true" : "false"} />
          <div>
            <Button type="submit" disabled={dispPending}>
              บันทึก
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
