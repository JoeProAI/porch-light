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
  title: "Porch Light | Storm warning. Clear first call.",
  description: "An emergency-operations call sheet for dialysis centers and nursing homes in a storm-warning area. Real phones, transparent ranking and inspectable evidence. Retrospective prototype.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Porch Light | Storm warning. Clear first call.",
    description: "A sourced call sheet for dialysis centers and nursing homes in the Manatee warning area. Milton retrospective, not live emergency guidance.",
    url: "https://porchlight.earth",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Porch Light ranked facility ledger, Manatee County retrospective" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Porch Light | Storm warning. Clear first call.",
    description: "Manatee County, Milton retrospective. Real source records and inspectable Zetaris query evidence.",
    images: ["/twitter-image"],
  },
};
export const viewport: Viewport = { themeColor: "#05070b", colorScheme: "dark" };

export const RootLayout = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <html lang="en"><body>{children}</body></html>
);
export default RootLayout;
