import type { Metadata } from "next";
import { Nationwide } from "@/components/nationwide";

export const metadata: Metadata = {
  title: "National Care-Facility Outreach | Porch Light",
  description: "Run the real audited source chain for a US county or captured NWS alert. Inspect the ranked call sheet, grounded Nemotron drafts, refusals and missing data.",
};
export const dynamic = "force-dynamic";
export const Page = () => <Nationwide />;
export default Page;
