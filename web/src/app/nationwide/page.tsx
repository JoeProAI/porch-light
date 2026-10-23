import type { Metadata } from "next";
import { Nationwide } from "@/components/nationwide";

export const metadata: Metadata = {
  title: "National Care-Facility Outreach | Porch Light",
  description: "Search any US county or an active NWS alert. Inspect the ranked call sheet, Zetaris query IDs, source gaps, and grounded Nemotron drafts.",
};
export const dynamic = "force-dynamic";
export const Page = () => <Nationwide />;
export default Page;
