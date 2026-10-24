import type { Metadata, Viewport } from "next";
import "@fontsource/libre-baskerville/latin-400.css";
import "@fontsource/libre-baskerville/latin-400-italic.css";
import "@fontsource/atkinson-hyperlegible/latin-400.css";
import "@fontsource/atkinson-hyperlegible/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://porchlight.earth"),
  icons: { icon: "/icon.svg" },
  title: "Porch Light | Pick any US county.",
  description: "A sourced call sheet for dialysis centers and nursing homes in a US county, or for counties mapped from an active weather alert. Each run returns that county's audited rows and source gaps.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Porch Light | Pick any US county.",
    description: "Run one US county or one active weather alert. The call sheet is that run's audited rows and source gaps.",
    url: "https://porchlight.earth",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Porch Light. Pick any US county. One run, audited rows, source gaps." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Porch Light | Pick any US county.",
    description: "One county or one active alert per run. Audited rows and source gaps from that run.",
    images: ["/twitter-image"],
  },
};
export const viewport: Viewport = { themeColor: "#05070b", colorScheme: "dark" };

export const RootLayout = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <html lang="en"><body>{children}</body></html>
);
export default RootLayout;
