import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const files: Record<string, string> = {
  "maplibre-gl.mjs": "maplibre-gl.mjs",
  "maplibre-gl-worker.mjs": "maplibre-gl-worker.mjs",
};

export const GET = async (_request: Request, context: { params: Promise<{ file: string }> }): Promise<Response> => {
  const { file } = await context.params;
  if (!Object.hasOwn(files, file)) return new Response("Unknown map library file.", { status: 404 });
  const name = files[file];
  const bytes = await readFile(/* turbopackIgnore: true */ join(process.cwd(), "node_modules/maplibre-gl/dist", name));
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
};
