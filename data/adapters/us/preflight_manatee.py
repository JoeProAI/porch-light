"""Report real ingestion coverage and refusals, never a runtime rank or Zetaris join."""

import json

from data.adapters.us.county_sources import EMPOWER, SVI, selected_sources
from data.adapters.us.preflight_county import report_for_county

CENSUS = selected_sources("manatee").census
CEMP = selected_sources("manatee").plan


def report() -> dict:
    return report_for_county("manatee")


def main() -> int:
    print(json.dumps(report(), indent=2))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
