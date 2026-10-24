"""Porch Light contract types. Mirror of contract/openapi.yaml schemas.

Country agnostic: everything adapter specific arrives via ExternalKey and
the country field, never a US-only column. Dataclasses only, no third
party deps, so every agent can import this file.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

CountryCode = str  # lowercase adapter key: "us", "jm", ...


class ExternalKeyType(str, Enum):
    CCN = "ccn"
    OSM_ID = "osm_id"
    WORLDPOP_CELL = "worldpop_cell"
    GDACS_EVENT = "gdacs_event"
    CAP_ID = "cap_id"
    UGC = "ugc"
    FIPS = "fips"
    TRACT_GEOID = "tract_geoid"
    ZIP = "zip"
    SSA_COUNTY = "ssa_county"
    NWS_ZONE = "nws_zone"


@dataclass
class ExternalKey:
    type: ExternalKeyType
    value: str


class AlertSource(str, Enum):
    NWS = "nws"
    IEM = "iem"
    GDACS = "gdacs"
    CAP = "cap"
    MOCK = "mock"


class ZoneKind(str, Enum):
    COUNTY = "county"
    ZONE = "zone"
    TRACT = "tract"
    ADMIN = "admin"
    GRID = "grid"
    CAP_AREA = "cap_area"


@dataclass
class ZoneRef:
    id: str
    kind: ZoneKind
    name: Optional[str] = None
    country: Optional[CountryCode] = None


@dataclass
class Zone(ZoneRef):
    country: CountryCode = ""
    keys: list[ExternalKey] = field(default_factory=list)
    geometry: Optional[dict] = None


@dataclass
class Vtec:
    office: Optional[str] = None
    phenomena: Optional[str] = None
    significance: Optional[str] = None
    event_id: Optional[int] = None


@dataclass
class Alert:
    id: str
    country: CountryCode
    source: AlertSource
    event: str
    headline: str
    sent: str  # ISO 8601
    zone_based: bool
    affected_zones: list[ZoneRef] = field(default_factory=list)
    severity: Optional[str] = None
    urgency: Optional[str] = None
    certainty: Optional[str] = None
    effective: Optional[str] = None
    expires: Optional[str] = None
    geocode: Optional[dict] = None  # {"ugc": [...], "same": [...]}
    geometry: Optional[dict] = None  # GeoJSON; None for zone-based alerts
    vtec: Optional[Vtec] = None
    raw_ref: Optional[str] = None
    fetched_at: Optional[str] = None
    mock: Optional[bool] = None


class BuiltFrom(str, Enum):
    ZONE_SHAPES = "zone_shapes"
    STORM_POLYGON = "storm_polygon"
    ADMIN_BOUNDARY = "admin_boundary"
    GDACS_BUFFER = "gdacs_buffer"


@dataclass
class WarningArea:
    id: str
    country: CountryCode
    built_from: BuiltFrom
    keys: list[ExternalKey]
    zones: list[ZoneRef] = field(default_factory=list)
    geometry: Optional[dict] = None
    area_km2: Optional[float] = None


@dataclass
class AlertList:
    items: list[Alert]
    empty_state: Optional["EmptyState"] = None


@dataclass
class CreateRunRequest:
    """Exactly one of alert_id or alert."""
    alert_id: Optional[str] = None
    alert: Optional[Alert] = None
    country: Optional[CountryCode] = None

    def __post_init__(self) -> None:
        if (self.alert_id is None) == (self.alert is None):
            raise ValueError("exactly one of alert_id or alert is required")


class RunStatus(str, Enum):
    QUEUED = "queued"
    BUILDING_AREA = "building_area"
    FINDING_FACILITIES = "finding_facilities"
    MEASURING_JOINS = "measuring_joins"
    SCORING = "scoring"
    WRITING_REASONS = "writing_reasons"
    READY = "ready"
    EXPORTING = "exporting"
    DONE = "done"
    FAILED = "failed"


@dataclass
class RunCounts:
    facilities: int = 0
    joins_accepted: int = 0
    joins_failed: int = 0
    checkins_done: int = 0


@dataclass
class Run:
    id: str
    status: RunStatus
    alert: Alert
    created_at: str
    warning_area: Optional[WarningArea] = None
    snapshot_id: Optional[str] = None
    country: Optional[CountryCode] = None
    counts: Optional[RunCounts] = None
    updated_at: Optional[str] = None
    error: Optional["ApiErrorBody"] = None


class FacilityType(str, Enum):
    DIALYSIS = "dialysis"
    NURSING_HOME = "nursing_home"
    HOME_HEALTH = "home_health"
    HOSPITAL = "hospital"
    CLINIC = "clinic"
    OTHER = "other"


@dataclass
class GeocodeInfo:
    source: Optional[str] = None
    match_quality: Optional[str] = None  # exact | partial | tied | failed


@dataclass
class FacilityPhone:
    status: str
    value: Optional[str] = None
    source: Optional["SourceRef"] = None
    source_record_key: Optional[str] = None
    reason: Optional[str] = None

    def __post_init__(self):
        if self.status == "available":
            if not self.value or self.source is None:
                raise ValueError("An available phone requires its actual source and value")
        elif self.status != "unavailable" or self.value is not None or not self.reason:
            raise ValueError("An unavailable phone requires a reason and no value")


@dataclass
class Facility:
    id: str
    country: CountryCode
    name: str
    type: FacilityType
    key: ExternalKey  # ccn in the US, osm_id in the global adapter
    lat: float
    lon: float
    alt_keys: list[ExternalKey] = field(default_factory=list)
    address: Optional[str] = None
    phone: Optional[FacilityPhone] = None
    zip: Optional[str] = None
    county_key: Optional[ExternalKey] = None
    tract_key: Optional[ExternalKey] = None
    geocode: Optional[GeocodeInfo] = None
    attributes: dict[str, Any] = field(default_factory=dict)
    score: Optional["ScoreBreakdown"] = None
    evidence: Optional["Evidence"] = None
    mock: Optional[bool] = None


class ScoreTermName(str, Enum):
    TYPE_WEIGHT = "type_weight"
    SVI_PCT = "svi_pct"
    EMPOWER_DENSITY_PCT = "empower_density_pct"
    CMS_RISK = "cms_risk"
    PLAN_FLAG = "plan_flag"


@dataclass
class ScoreTerm:
    name: ScoreTermName
    input: float
    weight: float
    weighted: float
    note: Optional[str] = None


@dataclass
class ScoreBreakdown:
    total: float
    terms: list[ScoreTerm]
    formula_version: str
    rank: int
    tie_break: Optional[str] = None

    def __post_init__(self):
        if not isinstance(self.rank, int) or isinstance(self.rank, bool) or self.rank < 1:
            raise ValueError("A ranked score requires a positive integer rank")


@dataclass
class SourceRef:
    name: str
    license: str
    dataset_id: Optional[str] = None
    url: Optional[str] = None


@dataclass
class DataAsOf:
    source: str
    fetched_at: str
    snapshot_id: str
    stale: bool
    modified: Optional[str] = None
    provenance_file: Optional[str] = None


class JoinMethod(str, Enum):
    EXACT_KEY = "exact_key"
    SSA_TO_FIPS_CROSSWALK = "ssa_to_fips_crosswalk"
    CENSUS_GEOCODE = "census_geocode"
    POSTGIS_POINT_IN_POLYGON = "postgis_point_in_polygon"
    ZIP_TO_EMPOWER = "zip_to_empower"
    OSM_ADMIN_LOOKUP = "osm_admin_lookup"


@dataclass
class JoinHop:
    from_key: ExternalKeyType
    to_key: ExternalKeyType
    method: JoinMethod
    match_rate: float  # measured by Zetaris SQL, never an LLM confidence
    query_id: Optional[str] = None


@dataclass
class DqResult:
    rule: str
    passed: bool
    detail: Optional[str] = None


@dataclass
class Fact:
    name: str
    value: Any
    query_id: str
    unit: Optional[str] = None


@dataclass
class RuleCite:
    cite: str  # e.g. "42 CFR 494.62"
    plan_section: Optional[str] = None
    page: Optional[int] = None


class MeterlessMode(str, Enum):
    DEEP = "meterless/deep"
    FAST = "meterless/fast"
    LOCAL = "meterless/local"


class ModelProvider(str, Enum):
    LOCAL = "local"
    NIM = "nim"
    NONE = "none"


@dataclass
class Reason:
    text: str
    trace_id: str
    rule_cites: list[RuleCite] = field(default_factory=list)
    model_id: Optional[str] = None
    mode: Optional[MeterlessMode] = None
    provider: Optional[ModelProvider] = None


@dataclass
class Evidence:
    zetaris_query_ids: list[str]
    sources: list[SourceRef]
    data_as_of: list[DataAsOf]
    join_path: list[JoinHop]
    score: ScoreBreakdown
    dq_results: list[DqResult]
    failed_joins: list["FailedJoin"]
    facts: list[Fact]
    reason: Optional[Reason] = None
    ledger_ids: list[str] = field(default_factory=list)


class JoinStatus(str, Enum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    REFUSED = "refused"


@dataclass
class JoinProposal:
    id: str
    from_key: ExternalKeyType
    to_key: ExternalKeyType
    method: JoinMethod
    status: JoinStatus
    from_table: Optional[str] = None
    to_table: Optional[str] = None
    measured_match_rate: Optional[float] = None
    fan_out: Optional[float] = None
    threshold: Optional[float] = None
    seen_before: Optional[bool] = None
    query_id: Optional[str] = None


@dataclass
class FailedJoin:
    from_key: ExternalKeyType
    to_key: ExternalKeyType
    method: JoinMethod
    reason: str
    row_count: Optional[int] = None
    query_id: Optional[str] = None


@dataclass
class JoinReport:
    proposals: list[JoinProposal]
    failed: list[FailedJoin]


@dataclass
class TraceStep:
    step: str
    provider: ModelProvider
    started_at: str
    model_id: Optional[str] = None
    mode: Optional[str] = None  # MeterlessMode or "none"
    latency_ms: Optional[int] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    tokens_per_sec: Optional[float] = None
    trace_id: Optional[str] = None
    query_ids: list[str] = field(default_factory=list)
    detail: Optional[str] = None


@dataclass
class Trace:
    run_id: str
    steps: list[TraceStep]


class CheckInStatus(str, Enum):
    CALLED = "called"
    ANSWERED = "answered"
    NO_ANSWER = "no_answer"


@dataclass
class CheckIn:
    facility_id: str
    status: CheckInStatus
    by: str  # staff initials or role, never a patient or resident name
    at: str
    note: Optional[str] = None


@dataclass
class CheckInList:
    items: list[CheckIn]


class ContractAction(str, Enum):
    EXPORT_CALL_SHEET = "export_call_sheet"
    EXPORT_CSV = "export_csv"
    DRAFT_CALL_SCRIPT = "draft_call_script"


@dataclass
class Contract:
    id: str
    action: ContractAction
    engine: str  # "scout_intent"
    request_hash: str
    signed_at: str
    signature: str
    inputs_hash: Optional[str] = None
    evidence_ids: list[str] = field(default_factory=list)
    trace_ids: list[str] = field(default_factory=list)
    disclaimers: list[str] = field(default_factory=list)


@dataclass
class RankedFacility(Facility):
    """A facility after ranking: the call sheet always carries score and
    evidence. Raw Facility stays for adapter output pre-scoring."""
    score: ScoreBreakdown = field(kw_only=True)
    evidence: Evidence = field(kw_only=True)

    def __post_init__(self):
        if self.score is None or self.evidence is None:
            raise ValueError("Ranked rows require both score and evidence")


@dataclass
class ExportArtifact:
    format: str  # csv | print_sheet | call_script
    sha256: str
    href: str  # download path under /runs/{id}/exports/{export_id}/artifacts/{format}
    media_type: Optional[str] = None
    filename: Optional[str] = None


@dataclass
class ExportRequest:
    formats: list[str]  # csv | print_sheet | call_script
    include_call_script: bool = False


@dataclass
class ExportReceipt:
    export_id: str
    run_id: str
    created_at: str
    artifacts: list[ExportArtifact]  # one per requested format, retrievable at href
    zetaris_query_ids: list[str]
    snapshot_id: str
    contract_signature: str
    csv_sha256: Optional[str] = None  # present when the csv format was exported
    model_trace_ids: list[str] = field(default_factory=list)
    contract: Optional[Contract] = None
    held: list[str] = field(default_factory=list)


@dataclass
class FacilityList:
    items: list["RankedFacility"]
    total: Optional[int] = None
    empty_state: Optional["EmptyState"] = None


class EmptyStateCode(str, Enum):
    NO_FACILITIES = "no_facilities"
    NO_ALERTS = "no_alerts"
    NO_JOINS = "no_joins"
    NO_DEPENDENTS_DATA = "no_dependents_data"


@dataclass
class EmptyState:
    code: EmptyStateCode
    message: str


class ErrorCode(str, Enum):
    NOT_FOUND = "not_found"
    BAD_REQUEST = "bad_request"
    NO_FACILITIES = "no_facilities"
    SOURCE_STALE = "source_stale"
    ZETARIS_DOWN = "zetaris_down"
    METERLESS_UNAUTHORIZED = "meterless_unauthorized"
    METERLESS_OFFLINE = "meterless_offline"
    TIMEOUT = "timeout"
    EXPORT_REFUSED = "export_refused"


@dataclass
class ApiErrorBody:
    code: ErrorCode
    message: str
    detail: Any = None
    retry_after_ms: Optional[int] = None


@dataclass
class ApiError:
    error: ApiErrorBody


class ServiceState(str, Enum):
    UP = "up"
    DOWN = "down"
    UNAUTHORIZED = "unauthorized"
    OFFLINE = "offline"
    DEGRADED = "degraded"


@dataclass
class ServiceStatus:
    status: ServiceState
    latency_ms: Optional[int] = None
    detail: Optional[str] = None


@dataclass
class MeterlessStatus(ServiceStatus):
    provider: Optional[ModelProvider] = None
    mode: Optional[str] = None


@dataclass
class NetworkStatus:
    status: str  # "online" | "offline"


@dataclass
class SnapshotStatus:
    snapshot_id: str
    data_as_of: list[DataAsOf]
    age_minutes: Optional[float] = None


@dataclass
class Health:
    zetaris: ServiceStatus
    meterless: MeterlessStatus
    network: NetworkStatus
    snapshot: SnapshotStatus
