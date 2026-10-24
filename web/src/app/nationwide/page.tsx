import type { Metadata } from "next";
import { Nationwide } from "@/components/nationwide";

export const metadata: Metadata = {
  title: "National Care-Facility Outreach | Porch Light",
  description: "Search or click any US county, or choose an active weather alert. The page shows that run's audited rows, source gaps, query IDs, and grounded Nemotron drafts.",
};
export const dynamic = "force-dynamic";
export const Page = () => <Nationwide />;
export default Page;
