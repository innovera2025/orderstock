// Sarabun (OFL 1.1) is self-hosted via explicit @font-face rules in
// src/app/fonts.css (Google ships Thai and Latin as separate subset files, so each
// weight is declared twice with a per-subset unicode-range — a shape next/font/local
// cannot express). This module owns the canonical font-family stack so layout and any
// future component reference one source of truth.
//
// Fallback chain: Sarabun → "TH Sarabun New" (common on Thai Windows/office PCs) →
// generic sans-serif. The self-hosted Sarabun always loads first; the fallbacks only
// matter before the woff2 finishes loading or if bundling ever fails.
export const sarabunFontFamily =
  "'Sarabun', 'TH Sarabun New', sans-serif";
