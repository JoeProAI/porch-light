import type { Metadata } from "next";
import { StormWatch } from "@/components/storm-watch";

export const metadata: Metadata = {
  title: "Storm Watch | Porch Light",
  description: "Iowa Environmental Mesonet radar and National Weather Service alerts with published shapes. Nationwide weather only. Facility call sheets live on the county desk.",
};
export const dynamic = "force-dynamic";

export const Page = () => <StormWatch />;
export default Page;
