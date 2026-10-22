import "server-only";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import type { Provenance, Snapshot } from "./types";

export const readSnapshot = async (): Promise<{ snapshot: Snapshot; provenance: Provenance }> => {
  const root = path.join(process.cwd(), "data");
  const [bytes, sidecar] = await Promise.all([
    readFile(path.join(root, "manatee-ranked.json")),
    readFile(path.join(root, "manatee-ranked.json.provenance.json"), "utf8"),
  ]);
  const provenance: Provenance = JSON.parse(sidecar);
  if (createHash("sha256").update(bytes).digest("hex") !== provenance.sha256) {
    throw new Error("Snapshot integrity check failed.");
  }
  const snapshot: Snapshot = JSON.parse(bytes.toString("utf8"));
  if (
    snapshot.schema_version !== "porch-light.manatee-development-snapshot.v1" ||
    snapshot.scenario.mode !== "retrospective" ||
    !["postgis_development", "zetaris"].includes(snapshot.data_access.data_access_mode) ||
    !Array.isArray(snapshot.facilities) ||
    snapshot.facilities.length !== snapshot.counts.ranked_rows ||
    snapshot.refused.length !== snapshot.counts.refused_rows ||
    snapshot.counts.source_rows !== snapshot.counts.ranked_rows + snapshot.counts.refused_rows ||
    snapshot.warning_geometry.type !== "MultiPolygon"
  ) throw new Error("Unsupported or incomplete development snapshot.");
  for (const [i, row] of snapshot.facilities.entries()) {
    if (row.rank !== i + 1 || !Number.isFinite(row.score.total) ||
      row.score.terms.some(term => ![term.input, term.weight, term.weighted].every(Number.isFinite)) ||
      Math.abs(row.score.terms.reduce((sum, term) => sum + term.weighted, 0) - row.score.total) > 1e-9) {
      throw new Error("Snapshot ranking or weighted terms failed validation.");
    }
  }
  if (JSON.stringify(snapshot.data_access.zetaris_query_ids).includes("zq-mock") ||
    snapshot.facilities.some(row => row.evidence.zetaris_query_ids.some(id => id.includes("zq-mock")))) {
    throw new Error("Non-genuine query references rejected.");
  }
  if (snapshot.data_access.data_access_mode === "zetaris") {
    const audit = snapshot.data_access.zetaris_audit;
    const ids = snapshot.data_access.zetaris_query_ids;
    if (!audit?.finish_successfully || !audit.end_time || !audit.query_id ||
      !ids.includes(audit.query_id) ||
      snapshot.facilities.some(row => row.evidence.zetaris_query_ids.length === 0 ||
        row.evidence.zetaris_query_ids.some(id => !ids.includes(id)))) {
      throw new Error("Zetaris mode requires a successful audit receipt and closed row references.");
    }
  }
  return { snapshot, provenance };
};
