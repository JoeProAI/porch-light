"""Deterministic prototype ranking over observed inputs, with an explicit policy."""

import re
from decimal import Decimal

WEIGHTS = {
    "type_weight": Decimal("0.30"),
    "svi_pct": Decimal("0.25"),
    "empower_density_pct": Decimal("0.20"),
    "cms_risk": Decimal("0.15"),
    "plan_flag": Decimal("0.10"),
}
TYPE_WEIGHTS = {"dialysis": Decimal("1.0"), "nursing_homes": Decimal("0.8")}
POLICY_VERSION = "manatee-development-v1"


def normalized_text(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", value.lower())).strip()


def decimal(value) -> Decimal:
    result = Decimal(str(value))
    if not result.is_finite():
        raise ValueError("Non-finite source value")
    return result


def score_manatee(bundle: dict, plan_text: str) -> tuple[list[dict], list[dict]]:
    if not plan_text.strip():
        raise ValueError("The actual archived county-plan text is required")
    ratios = []
    for row in bundle["zip_context"]:
        count = row.get("Power_Dependent_Devices_DME")
        total = row.get("Medicare_Benes")
        if isinstance(count, int) and count >= 0 and isinstance(total, int) and total > 0:
            ratios.append(decimal(count) / decimal(total))
    if not ratios:
        raise ValueError("No source-reported Manatee ZIP ratios are available")
    plan = normalized_text(plan_text)
    ranked, refused = [], []
    for row in bundle["rows"]:
        reason = None
        if row["geography_status"] != "census_geography_returned":
            reason = row["geography_status"]
        elif row["warning_covers"] is not True:
            reason = "outside_or_unverified_warning_geometry"
        elif row["empower_source_row_count"] != 1 or row["national_svi_percentile"] is None:
            reason = "required_source_context_unavailable"
        elif not row["source_phone"] or not row["source_phone"].strip():
            reason = "source_phone_unavailable"
        if reason:
            refused.append({"ccn": row["ccn"], "name": row["facility_name"], "reason": reason})
            continue
        raw = row["raw_record"]
        try:
            stars = decimal(raw.get("Overall Rating") if row["source_kind"] == "nursing_homes"
                            else raw.get("Five Star"))
            if not 1 <= stars <= 5:
                raise ValueError("CMS rating is unavailable")
            count = decimal(row["reported_zip_dme_count"])
            beneficiaries = decimal(row["reported_zip_medicare_beneficiaries"])
            if count < 0 or beneficiaries <= 0:
                raise ValueError("ZIP source counts are invalid")
            ratio = count / beneficiaries
            midrank = (
                decimal(sum(value < ratio for value in ratios))
                + decimal(sum(value == ratio for value in ratios)) / 2
            ) / decimal(len(ratios))
            name = normalized_text(row["facility_name"])
            named = bool(name and name in plan)
            inputs = {
                "type_weight": TYPE_WEIGHTS[row["source_kind"]],
                "svi_pct": decimal(row["national_svi_percentile"]),
                "empower_density_pct": midrank,
                "cms_risk": (5 - stars) / 4,
                "plan_flag": decimal(int(named)),
            }
            if any(not 0 <= value <= 1 for value in inputs.values()):
                raise ValueError("A normalized source/policy input is outside range")
        except (ValueError, TypeError, ArithmeticError):
            refused.append({"ccn": row["ccn"], "name": row["facility_name"],
                            "reason": "required_scoring_input_unavailable"})
            continue
        terms = [{
            "name": name, "input": float(value), "weight": float(WEIGHTS[name]),
            "weighted": float(value * WEIGHTS[name]),
        } for name, value in inputs.items()]
        total = sum(inputs[key] * WEIGHTS[key] for key in WEIGHTS)
        artifact = bundle["artifacts"][row["source_artifact_path"]]
        kind = "nursing_home" if row["source_kind"] == "nursing_homes" else "dialysis"
        ranked.append({
            "id": "us:ccn:" + row["ccn"], "ccn": row["ccn"], "country": "us",
            "name": row["facility_name"], "type": kind,
            "key": {"type": "ccn", "value": row["ccn"]},
            "county_key": {"type": "fips", "value": "12081"},
            "lat": row["latitude"], "lon": row["longitude"],
            "address": raw.get("Provider Address", raw.get("Address Line 1", "")),
            "zip": raw["ZIP Code"],
            "phone": {"status": "available", "value": row["source_phone"],
                      "source_record_key": row["ccn"], "source": {
                          "name": "CMS " + row["source_kind"], "url": artifact["source_url"],
                          "license": artifact["license"],
                      }},
            "score": {"total": float(total), "terms": terms,
                      "formula_version": POLICY_VERSION, "tie_break": "facility type, then CCN"},
            "context": {"cms_stars": float(stars), "national_svi_percentile": float(inputs["svi_pct"]),
                        "source_reported_zip_dme": int(count),
                        "source_reported_zip_medicare_beneficiaries": int(beneficiaries),
                        "reported_zip_ratio": float(ratio),
                        "county_zip_reference_rows": len(ratios),
                        "small_count_caution": row["small_count_caution"]},
            "evidence": {
                "zetaris_query_ids": list(bundle["read_receipt"]["zetaris_query_ids"]),
                "sources": [{"name": "CMS " + row["source_kind"],
                             "url": artifact["source_url"], "license": artifact["license"]}],
                "data_as_of": [{
                    "source": "CMS " + row["source_kind"],
                    "fetched_at": artifact["fetched_at"],
                    "snapshot_id": bundle["snapshot_hash"], "stale": True,
                }],
                "join_path": [],
                "dq_results": [
                    {"rule": "current_zone_geometry_covers_point", "passed": True},
                    {"rule": "sourced_phone_present", "passed": True},
                    {"rule": "historical_2024_geometry_verified", "passed": False},
                    {"rule": "county_plan_current_applicability_verified", "passed": False},
                ],
                "failed_joins": [],
                "facts": [{
                    "name": name, "value": value,
                    "query_id": bundle["read_receipt"]["zetaris_query_ids"][0],
                } for name, value in {
                    "facility_type": kind,
                    "svi_pct": float(inputs["svi_pct"]),
                    "empower_dme_count": int(count),
                    "empower_medicare_beneficiaries": int(beneficiaries),
                    "cms_star_rating": float(stars),
                }.items()] if bundle["read_receipt"]["zetaris_query_ids"] else [],
                "source_artifact_path": row["source_artifact_path"],
                "source_sha256": artifact["sha256"],
                "geography_artifact_path": row["geography_artifact_path"],
                "svi_artifact_path": row["svi_source_artifact_path"],
                "geography": row["geography_evidence_json"],
                "read_receipt": bundle["read_receipt"],
                "archived_plan_exact_name_mention": named,
                "plan_applicability_verified": False,
                "operator_geocode_review_required": row["address_quality_review_required"],
                "model_explanation": None,
            },
            "computed_reason": (
                f"National tract SVI {inputs['svi_pct']}; CMS stars {stars}; "
                f"published ZIP DME {int(count)}/{int(beneficiaries)}. "
                "ZIP context is not a facility patient count."
            ),
            "development_only": bundle["read_receipt"]["data_access_mode"] != "zetaris",
        })
    ranked.sort(key=lambda row: (-row["score"]["total"], row["type"], row["ccn"]))
    for rank, row in enumerate(ranked, 1):
        row["rank"] = rank
        row["score"]["rank"] = rank
        row["evidence"]["score"] = row["score"]
    return ranked, refused
