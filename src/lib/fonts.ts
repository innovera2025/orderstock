// pguard type system (Phase 01). IBM Plex family loaded via next/font/google — self-hosted
// at build time (no runtime CDN fetch), with automatic size-adjust fallback metrics.
//
// - IBM Plex Sans Thai: primary UI font. subsets ['thai','latin'] so Thai tone marks/vowels
//   AND Latin glyphs both come from one shaped family. Exposed as --font-thai.
// - IBM Plex Sans: Latin-optimized companion. Exposed as --font-latin.
// - IBM Plex Mono: numerals / IDs / codes. Exposed as --font-mono.
//
// The three `.variable` class names are applied to <html> in the root layout so the CSS
// custom properties are available app-wide; globals.css / the pguard token layer consume them.
import {
  IBM_Plex_Sans_Thai,
  IBM_Plex_Sans,
  IBM_Plex_Mono,
} from "next/font/google";

export const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-thai",
  display: "swap",
});

export const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-latin",
  display: "swap",
});

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

// Combined className for <html>; keeps the three CSS-var declarations in one place.
export const fontVariables = `${ibmPlexSansThai.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`;
