"""Country adapter interface (contract/adapter.md).

One implementation per country under data/adapters/<country>/. The runtime
surface below returns contract types only; build-time fetch/load/provenance
follows the skeleton in data/adapters/us/README.md (fetch raw into
data/snapshot/raw/<source_key>/, write .provenance.json sidecars, load
into the PostGIS snapshot). At runtime the app reads only through Zetaris
SQL; an adapter registers tables, it never serves the app directly.
"""
from __future__ import annotations

from enum import Enum
from typing import Protocol

from .types import (
    Alert,
    CountryCode,
    DataAsOf,
    Fact,
    Facility,
    FacilityType,
    RuleCite,
    Zone,
    ZoneRef,
)


class AlertMode(str, Enum):
    ARCHIVED = "archived"
    LIVE = "live"


class CountryAdapter(Protocol):
    """What every country adapter answers. See contract/adapter.md."""

    country: CountryCode

    def alerts(self, mode: AlertMode) -> tuple[list[Alert], list[Zone]]:
        """Archived alerts come from committed captures; live alerts from a
        live feed registered as a Zetaris REST table."""

    def areas(self, zone: ZoneRef) -> list[Zone]:
        """Admin areas and small areas inside a warning zone: county FIPS
        and Census tracts in the US, OSM admin boundaries and WorldPop
        cells in the global adapter."""

    def facilities(self, area: ZoneRef) -> list[Facility]:
        """Facilities inside an area. Key type is adapter specific:
        ccn (US CMS), osm_id (global OSM)."""

    def vulnerability(self, area: ZoneRef) -> list[Fact]:
        """Vulnerability facts per area (SVI in the US, WorldPop elsewhere)."""

    def dependents(self, area: ZoneRef) -> list[Fact]:
        """Aggregate electricity-dependent counts only. The global adapter
        returns an empty list and the UI says there is no open equivalent."""

    def rule_cites(self, facility_type: FacilityType) -> list[RuleCite]:
        """Preparedness rule cites per facility type (42 CFR in the US)."""

    def freshness(self) -> list[DataAsOf]:
        """Per-source freshness for data-as-of stamps and stale flags."""
