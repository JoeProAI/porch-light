import { ProjectEntry } from "@/components/project-entry";
import { readSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const Page = async () => {
  const { snapshot } = await readSnapshot();
  return <ProjectEntry snapshot={snapshot} />;
};
export default Page;
