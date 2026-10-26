import type { Metadata } from "next";
import { StormWatch } from "@/components/storm-watch";
import { readSnapshot } from "@/lib/snapshot";

export const metadata: Metadata = {
  title: "Storm Watch | Porch Light",
  description: "Iowa Environmental Mesonet radar and National Weather Service alerts with published shapes. Facility marks are an optional Milton retrospective, off by default.",
};
export const dynamic = "force-dynamic";

export const Page = async () => {
  try {
    const loaded = await readSnapshot();
    return <StormWatch snapshot={loaded.snapshot} provenance={loaded.provenance} sheetError="" />;
  } catch {
    return <StormWatch snapshot={null} provenance={null} sheetError="The ranked call sheet couldn't be verified. Facility pins are withheld." />;
  }
};
export default Page;
