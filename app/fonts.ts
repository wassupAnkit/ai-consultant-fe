import { Source_Serif_4 } from "next/font/google";
import localFont from "next/font/local";

/*
 * Two faces, the way claude.ai pairs them: a warm serif for the moments that carry the
 * product's voice (the greeting, the wordmark, headings inside an answer) and a humanist
 * sans for everything read or typed.
 *
 * The sans is General Sans — Expert Education's brand body face, the same static instances
 * the website ships (`eevs-website/src/app/(frontend)/fonts.ts`); per-weight hinting is what
 * keeps it crisp on 1x Windows monitors, which is most of the office. The serif is Source
 * Serif 4 with its optical-size axis, self-hosted by next/font at build time.
 */
export const generalSans = localFont({
  src: [
    { path: "./fonts/general-sans/GeneralSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/general-sans/GeneralSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/general-sans/GeneralSans-Semibold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/general-sans/GeneralSans-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-general-sans",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
});

export const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  // The variable instance carries every weight plus the optical-size axis in one file.
  weight: "variable",
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-serif",
  display: "swap",
  fallback: ["Georgia", "Cambria", "Times New Roman", "serif"],
});
