import { Operator } from "@/components/operator";
import { readSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const Page = async () => {
  const { snapshot, provenance } = await readSnapshot();
  return <Operator snapshot={snapshot} provenance={provenance} />;
};
export default Page;
