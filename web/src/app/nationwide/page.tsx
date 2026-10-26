import type { Metadata } from "next";
import { Nationwide } from "@/components/nationwide";

export const metadata: Metadata = {
  title: "National Care-Facility Outreach | Porch Light",
  description: "Warning shapes sit lightly on the county map. A click lands on the county. Check several counties to compare published sheets or export a shortlist.",
};
export const dynamic = "force-dynamic";
export const Page = () => <Nationwide />;
export default Page;
