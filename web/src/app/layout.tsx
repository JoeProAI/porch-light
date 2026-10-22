import type { Metadata, Viewport } from "next";
import "@fontsource/libre-baskerville/latin-400.css";
import "@fontsource/libre-baskerville/latin-400-italic.css";
import "@fontsource/alegreya-sans/latin-400.css";
import "@fontsource/alegreya-sans/latin-500.css";
import "@fontsource/alegreya-sans/latin-700.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("http://127.0.0.1:3101"),
  icons: { icon: "/icon.svg" },
  title: "Porch Light | Manatee call sheet",
  description: "A source-backed Manatee call-first atlas. Real Zetaris query evidence, deterministic ranking and manual contact tracking. Retrospective prototype, not live emergency guidance.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Porch Light | Know who to call first.",
    description: "Manatee County · Milton retrospective. A ranked call sheet with source evidence. Development snapshot, not live guidance.",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Porch Light ranked facility ledger, Manatee County retrospective" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Porch Light | Know who to call first.",
    description: "Manatee County, Milton retrospective. Real source records and inspectable Zetaris query evidence.",
    images: ["/twitter-image"],
  },
};
export const viewport: Viewport = { themeColor: "#121613", colorScheme: "dark" };

export const RootLayout = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <html lang="en"><body>{children}</body></html>
);
export default RootLayout;
