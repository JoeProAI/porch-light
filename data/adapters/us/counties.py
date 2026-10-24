"""County profiles verified against the captured official HHS county identifiers."""

from dataclasses import dataclass


@dataclass(frozen=True)
class CountyProfile:
    key: str
    name: str
    state: str
    fips: str


MANATEE = CountyProfile("manatee", "Manatee", "FL", "12081")
COUNTIES = {MANATEE.key: MANATEE}


def county_profile(key: str) -> CountyProfile:
    try:
        return COUNTIES[key.strip().lower()]
    except KeyError:
        raise ValueError("County is not in the verified pilot profiles") from None
