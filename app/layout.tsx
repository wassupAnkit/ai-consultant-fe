import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { generalSans, sourceSerif } from "./fonts";
import { AnalyticsProvider } from "@/components/analytics-provider";
import CustomToast from "@/components/custom-toast";
import { TooltipProvider } from "@/components/ui/tooltip";

const defaultUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: { default: "Edge — Expert Education", template: "%s · Edge" },
  description:
    "Edge is Expert Education's internal knowledge assistant for counsellors: grounded, cited answers about destinations, universities, requirements, costs, scholarships and visas.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Edge" },
  formatDetection: { telephone: false },
  openGraph: { type: "website", siteName: "Edge", title: "Edge — Expert Education", description: "Knowledge assistant for Expert Education counsellors." },
  twitter: { card: "summary", title: "Edge — Expert Education", description: "Knowledge assistant for Expert Education counsellors." },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // The page background per scheme (see --background in globals.css), so the browser chrome matches.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1117" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${generalSans.variable} ${sourceSerif.variable}`}>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        </ThemeProvider>
        <CustomToast />
        <AnalyticsProvider />
      </body>
    </html>
  );
}
