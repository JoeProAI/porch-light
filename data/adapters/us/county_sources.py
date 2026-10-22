"""Explicit source selections for the two verified pilot county intakes."""

from dataclasses import dataclass
from pathlib import Path

from data.adapters.us.counties import MANATEE, SARASOTA, CountyProfile, county_profile

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "data/snapshot/raw"
SVI = RAW / "svi/manatee-2022/SVI_2022_12081.csv"
EMPOWER = RAW / "empower/20261022T034841Z-6bed0765"
CMS = RAW / "cms/20261022T030046Z-a5ce96ba"
COASTAL = RAW / "nws/20261022T022303Z-b4222c27"


@dataclass(frozen=True)
class CountySources:
    profile: CountyProfile
    census: Path
    warning: Path
    plan: Path | None = None
    plan_year: int | None = None
    adoption_year: int | None = None


SOURCES = {
    MANATEE.key: CountySources(
        MANATEE,
        RAW / "census/20261022T033241Z-b99bf8af",
        RAW / "iem/20261022T030817Z-ad065921",
        RAW / "cemp/20261022T033833Z-30a3bbd5/bradenton_adoption_2020.pdf",
        2018, 2020,
    ),
    SARASOTA.key: CountySources(
        SARASOTA,
        RAW / "census/20261022T122355Z-be9e3a8d",
        RAW / "iem/20261022T123021Z-0919e9fc",
    ),
}


def selected_sources(key: str) -> CountySources:
    return SOURCES[county_profile(key).key]


def source_directories(keys: tuple[str, ...]) -> list[Path]:
    directories = {CMS, SVI.parent, EMPOWER}
    for key in keys:
        source = selected_sources(key)
        directories.update((source.census, source.warning))
        if source.plan is not None:
            directories.add(source.plan.parent)
    return sorted(directories)
