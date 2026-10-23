import { Operator } from "@/components/operator";
import { readSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const Page = async ({ searchParams }: { searchParams: Promise<{ evidence?: string }> }) => {
  const { snapshot, provenance } = await readSnapshot();
  const query = await searchParams;
  return <Operator snapshot={snapshot} provenance={provenance} initialEvidenceOpen={query.evidence === "first"} />;
};
export default Page;
