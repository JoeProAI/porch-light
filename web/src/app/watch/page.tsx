import type { Metadata } from "next";
import { StormWatch } from "@/components/storm-watch";

export const metadata: Metadata = {
  title: "Storm Watch | Porch Light",
  description: "Official NOAA observed radar and US National Weather Service alerts with capture age and Zetaris audit evidence.",
};
export const Page = () => <StormWatch />;
export default Page;
