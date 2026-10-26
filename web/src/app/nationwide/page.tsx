import type { Metadata } from "next";
import { Nationwide } from "@/components/nationwide";

export const metadata: Metadata = {
  title: "National Care-Facility Outreach | Porch Light",
  description: "Active National Weather Service alerts, then the published county catalog. A county opens its audited call sheet. Area text is not treated as a county.",
};
export const dynamic = "force-dynamic";
export const Page = () => <Nationwide />;
export default Page;
