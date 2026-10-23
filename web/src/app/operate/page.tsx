import { Operator } from "@/components/operator";
import { readSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const Page = async ({ searchParams }: { searchParams: Promise<{ evidence?: string; rank?: string }> }) => {
  const { snapshot, provenance } = await readSnapshot();
  const query = await searchParams;
  const rank = Number(query.rank);
  return <Operator snapshot={snapshot} provenance={provenance} initialEvidenceOpen={query.evidence === "first"} initialRank={Number.isInteger(rank) ? rank : undefined} />;
};
export default Page;
