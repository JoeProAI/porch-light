import { redirect } from "next/navigation";
import { Operator } from "@/components/operator";
import { BlockedCallSheet } from "@/components/national/engine-unreachable";
import { readSnapshot } from "@/lib/snapshot";
import "@/components/national/national.css";

export const dynamic = "force-dynamic";
export const Page = async ({ searchParams }: { searchParams: Promise<{ evidence?: string; rank?: string; county?: string; alert?: string }> }) => {
  const query = await searchParams;
  if (query.county !== undefined || query.alert !== undefined) {
    if (query.county !== undefined && !/^\d{5}$/.test(query.county)) {
      return <BlockedCallSheet heading="County source code must be five digits." detail="No Manatee call sheet was substituted." />;
    }
    if (query.alert !== undefined && (query.alert.length > 500 || !query.alert.startsWith("https://api.weather.gov/alerts/"))) {
      return <BlockedCallSheet heading="That alert identifier is not an official NWS alert." detail="No Manatee call sheet was substituted." />;
    }
    const params = new URLSearchParams();
    if (query.county) params.set("county", query.county);
    if (query.alert) params.set("alert", query.alert);
    redirect(`/nationwide?${params.toString()}`);
  }
  const { snapshot, provenance } = await readSnapshot();
  const rank = Number(query.rank);
  return <Operator snapshot={snapshot} provenance={provenance} initialEvidenceOpen={query.evidence === "first"} initialRank={Number.isInteger(rank) ? rank : undefined} />;
};
export default Page;
