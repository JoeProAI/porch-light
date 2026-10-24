import { createHash } from "node:crypto";
import { createGunzip } from "node:zlib";
import { createReadStream } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { Provenance } from "./types";

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const publishedRoot = (): string =>
  process.env.PORCHLIGHT_PUBLISHED_NATIONAL_ROOT ??
  path.resolve(process.cwd(), "data/national/published");

const readProvenance = async (file: string): Promise<Provenance> => {
  const [bytes, sidecar] = await Promise.all([
    readFile(file),
    readFile(file + ".provenance.json", "utf8"),
  ]);
  const provenance: unknown = JSON.parse(sidecar);
  if (
    !record(provenance) ||
    provenance.sha256 !== createHash("sha256").update(bytes).digest("hex") ||
    typeof provenance.source_url !== "string" ||
    typeof provenance.fetched_at_utc !== "string" ||
    typeof provenance.license !== "string" ||
    typeof provenance.fetch_command !== "string"
  ) {
    throw new Error("Published national artifact checksum or provenance failed");
  }
  return provenance as Provenance;
};

export const publishedPackAvailable = async (): Promise<boolean> => {
  try {
    await access(path.join(publishedRoot(), "catalog.json"));
    await access(path.join(publishedRoot(), "catalog.json.provenance.json"));
    await access(path.join(publishedRoot(), "manifest.json"));
    return true;
  } catch {
    return false;
  }
};

export const readPublishedCatalog = async (): Promise<{ value: unknown; provenance: Provenance }> => {
  const file = path.join(publishedRoot(), "catalog.json");
  const provenance = await readProvenance(file);
  const value: unknown = JSON.parse(await readFile(file, "utf8"));
  if (
    !record(value) ||
    !record(value.catalog) ||
    !Array.isArray(value.catalog.counties) ||
    !record(value.catalog.data_access) ||
    value.catalog.data_access.data_access_mode !== "zetaris" ||
    !Array.isArray(value.catalog.data_access.zetaris_query_ids) ||
    !value.catalog.data_access.zetaris_query_ids.length ||
    !record(value.publication) ||
    value.publication.mode !== "published_static"
  ) {
    throw new Error("Published national catalog failed audit checks");
  }
  return { value, provenance };
};

const gunzipJson = async (file: string): Promise<unknown> => {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    createReadStream(file)
      .pipe(createGunzip())
      .on("data", (chunk: Buffer) => chunks.push(chunk))
      .on("error", reject)
      .on("end", () => resolve());
  });
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
};

export const publishedCountyId = (fips: string): string =>
  createHash("sha256").update(`published-county:${fips}`).digest("hex").slice(0, 32);

export const readPublishedCounty = async (
  fips: string,
): Promise<{ id: string; value: unknown; provenance: Provenance }> => {
  if (!/^\d{5}$/.test(fips)) throw new Error("Invalid county source code");
  const file = path.join(publishedRoot(), "counties", `${fips}.json.gz`);
  try {
    await access(file);
  } catch {
    throw new Error("No published audited snapshot exists for this county");
  }
  const provenance = await readProvenance(file);
  const value = await gunzipJson(file);
  if (
    !record(value) ||
    !record(value.county) ||
    value.county.fips !== fips ||
    !record(value.publication) ||
    value.publication.mode !== "published_sweep_snapshot"
  ) {
    throw new Error("Published county snapshot failed identity checks");
  }
  return { id: publishedCountyId(fips), value, provenance };
};

export const listPublishedCountySummaries = async (limit = 20): Promise<{
  id: string;
  county_name: string;
  state: string;
  fips: string;
  facility_count: number;
  alert_event: null;
  generated_at: string;
}[]> => {
  const { value } = await readPublishedCatalog();
  if (!record(value) || !record(value.catalog) || !Array.isArray(value.catalog.counties)) return [];
  const ranked = value.catalog.counties
    .filter((row): row is Record<string, unknown> => record(row) && typeof row.ranked_rows === "number" && row.ranked_rows > 0)
    .sort((a, b) => Number(b.ranked_rows) - Number(a.ranked_rows))
    .slice(0, Math.min(Math.max(1, Math.trunc(limit)), 20));
  const generated =
    record(value.publication) && typeof value.publication.generated_at === "string"
      ? value.publication.generated_at
      : new Date(0).toISOString();
  return ranked.map(row => ({
    id: publishedCountyId(String(row.fips)),
    county_name: String(row.name),
    state: String(row.state),
    fips: String(row.fips),
    facility_count: Number(row.ranked_rows),
    alert_event: null,
    generated_at: generated,
  }));
};

