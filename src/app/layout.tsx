import type { Metadata } from "next";
import "./globals.css";
import { fontVariables } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "ระบบจัดการออเดอร์สินค้า",
  description: "ระบบบันทึกและพิมพ์ใบออเดอร์สินค้าประจำวัน",
};

// No-flash theme bootstrap: set data-theme on <html> BEFORE first paint from the persisted
// choice (localStorage), so the pguard dark/light theme never flashes the wrong colors. When
// no explicit choice exists we leave data-theme unset and the CSS prefers-color-scheme
// fallback in globals.css takes over.
const NO_FLASH_THEME = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // IBM Plex (Thai/Latin/Mono) CSS-var classes applied here on <html> (next/font). lang="th"
  // for correct Thai line-breaking + tone-mark shaping. The app shell/nav lives in the (main)
  // route group layout so /print and /login structurally have no app chrome.
  return (
    <html lang="th" className={`h-full antialiased ${fontVariables}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
