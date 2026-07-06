import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ระบบจัดการออเดอร์สินค้า",
  description: "ระบบบันทึกและพิมพ์ใบออเดอร์สินค้าประจำวัน",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Sarabun is applied globally via body { font-family: var(--font-sarabun) } in
  // globals.css (self-hosted @font-face in fonts.css). lang="th" for correct Thai
  // line-breaking and tone-mark shaping.
  //
  // The top nav is NOT rendered here — it lives in the (main) route group layout so the
  // /print segment (its own layout) and the login page structurally have no app chrome.
  return (
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
