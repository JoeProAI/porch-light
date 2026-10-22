"""Export real Manatee development ranks with explicit source/policy/runtime limits."""

import argparse
import hashlib
import json
import os
import shlex
import sys
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader

from data.adapters.us.county_sources import selected_sources
from data.provenance.sidecar import sha256_of, verify, write_sidecar
from engines.data_access import ManateeRepository, register_zetaris_bundle_view, repository_for_mode
from engines.meterless import explain
from engines.ranking import POLICY_VERSION, TYPE_WEIGHTS, WEIGHTS, score_manatee

ROOT = Path(__file__).resolve().parents[1]


def build_snapshot(repository: ManateeRepository) -> dict:
    bundle = repository.read_bundle()
    zetaris = bundle["read_receipt"]["data_access_mode"] == "zetaris"
    plan = selected_sources("manatee").plan
    if plan is None or not verify(plan):
        raise RuntimeError("Actual archived Manatee plan required for the declared text-screen policy")
    reader = PdfReader(plan)
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    if len(text.strip()) < 1000:
        raise RuntimeError("County-plan text extraction failed; no zero-valued substitute")
    rows, refused = score_manatee(bundle, text)
    if not rows:
        raise RuntimeError("No real rows satisfy the declared development policy")
    return {
        "schema_version": "porch-light.manatee-development-snapshot.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "county": {"name": "Manatee", "fips": "12081", "state": "FL", "country": "us"},
        "scenario": {
            "mode": "retrospective", "event": "Hurricane Milton", "warning_year": 2024,
            "zone_geometry_vintage": "current published NWS shapes",
            "historical_2024_boundary_equivalence_verified": False,
        },
        "data_access": bundle["read_receipt"],
        "source_snapshot_hash": bundle["snapshot_hash"],
        "warning_geometry": json.loads(bundle["warning_geojson"]),
        "policy": {
            "version": POLICY_VERSION,
            "weights": {key: float(value) for key, value in WEIGHTS.items()},
            "type_weights": {key: float(value) for key, value in TYPE_WEIGHTS.items()},
            "cms_risk": "(5 - official source star rating) / 4",
            "empower_density_pct": (
                "midrank percentile of source-reported DME/Medicare-beneficiary ZIP ratio "
                "among published Manatee ZIP/county rows; not a facility patient count"
            ),
            "plan_flag": (
                "1 only for an exact normalized facility-name mention in the archived "
                "plan's extracted text, otherwise 0. A text-screen proxy, not a claim of "
                "current applicability or an exhaustive area-priority interpretation."
            ),
            "plan_artifact": str(plan.relative_to(ROOT)), "plan_sha256": sha256_of(plan),
            "plan_text_sha256": hashlib.sha256(text.encode()).hexdigest(),
            "plan_year": 2018, "plan_current_applicability_verified": False,
            "tie_break": "facility type, then CCN",
            "clinical_validation": False,
        },
        "counts": {"source_rows": len(bundle["rows"]), "ranked_rows": len(rows),
                   "refused_rows": len(refused)},
        "facilities": rows, "refused": refused,
        "model_executions": [],
        "limits": [
            ("Data served through licensed Zetaris JDBC with successful audit references."
             if zetaris else "Direct PostGIS development read, not a completed Zetaris/audit integration."),
            ("Per-row query IDs resolve to actual Zetaris audit records."
             if zetaris else "No mock query IDs. Actual Zetaris query references remain pending."),
            "Prototype policy mappings require operator review; not clinically validated.",
            "Current source records do not establish October 2024 facility conditions.",
            "Geocode quality and archived plan applicability remain unverified.",
            "No calls or messages are sent.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "engines/snapshots/manatee-ranked.json")
    parser.add_argument("--explain-top", type=int, default=0)
    parser.add_argument(
        "--data-access", choices=("zetaris", "postgis_development"),
        default=os.environ.get("PORCHLIGHT_DATA_ACCESS_MODE", "zetaris"),
    )
    parser.add_argument("--register-zetaris-view", action="store_true")
    parser.add_argument("--reuse-model-snapshot", type=Path)
    args = parser.parse_args()
    if args.register_zetaris_view:
        print(json.dumps(register_zetaris_bundle_view(), indent=2))
        return 0
    if not 0 <= args.explain_top <= 18:
        parser.error("Explanation batch must be between zero and eighteen rows")
    result = build_snapshot(repository_for_mode(args.data_access))
    if args.reuse_model_snapshot is not None:
        if not verify(args.reuse_model_snapshot):
            raise RuntimeError("Reusable model snapshot provenance does not verify")
        old = json.loads(args.reuse_model_snapshot.read_text())
        if old.get("source_snapshot_hash") != result["source_snapshot_hash"]:
            raise RuntimeError("Cannot reuse explanations from another source snapshot")
        old_rows = {row["ccn"]: row for row in old["facilities"]}
        if len(old_rows) != len(result["facilities"]):
            raise RuntimeError("Cannot reuse explanations after source scope changes")
        for row in result["facilities"]:
            previous = old_rows.get(row["ccn"])
            if previous is None or any(previous[key] != row[key] for key in (
                "name", "phone", "lat", "lon", "score", "context"
            )):
                raise RuntimeError("Cannot reuse model output after source/policy changes")
            row["evidence"]["model_explanation"] = previous["evidence"].get("model_explanation")
        result["model_executions"] = old["model_executions"]
        result["model_output_reuse"] = {
            "source_snapshot_sha256": sha256_of(args.reuse_model_snapshot),
            "original_generated_at": old["generated_at"],
            "new_model_call_performed": False,
        }
    model_failed = False
    if args.explain_top:
        try:
            execution = explain(result["facilities"][:args.explain_top])
        except RuntimeError as error:
            model_failed = True
            result["model_status"] = {"state": "failed", "detail": str(error),
                                      "fabricated_fallback": False}
        else:
            result["model_executions"].append(execution)
            by_ccn = {row["ccn"]: row["text"] for row in execution["explanations"]}
            for row in result["facilities"]:
                if row["ccn"] in by_ccn:
                    row["evidence"]["model_explanation"] = {
                        "text": by_ccn[row["ccn"]], "trace_id": execution["response_id"],
                        "model_id": execution["reported_model"], "mode": "meterless/deep",
                        "draft": True,
                    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(result, indent=2, ensure_ascii=True) + "\n"
    args.output.write_text(payload, encoding="utf-8")
    write_sidecar(
        args.output, (
            os.environ.get("PORCHLIGHT_ZETARIS_JDBC_URL", "jdbc:zetaris:lightning@localhost:10000")
            if args.data_access == "zetaris" else "postgresql://porchlight-postgis:5432/porchlight"
        ),
        "Derived from public CMS/Census/CDC/HHS/NWS and archived plan records; original terms retained",
        shlex.join([sys.executable, "-m", "engines.rank_manatee", *sys.argv[1:]]),
        result["generated_at"],
    )
    print(json.dumps({
        "snapshot_path": str(args.output), "counts": result["counts"],
        "first_three": [{"rank": row["rank"], "name": row["name"], "phone": row["phone"]["value"],
                         "score": row["score"]["total"]} for row in result["facilities"][:3]],
        "real_model_executions": len(result["model_executions"]),
        "data_access_mode": result["data_access"]["data_access_mode"],
        "zetaris_query_ids": result["data_access"]["zetaris_query_ids"],
    }, indent=2))
    return 2 if model_failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
