import { contactLabels, type Contacts, type Coordinate, type Facility, type Geometry, type Snapshot } from "./types";

export const formatDate = (value: string): string => new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
}).format(new Date(value)) + " UTC";

export const formatDateEt = (value: string): string => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Time unavailable";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York",
  }).format(parsed) + " ET";
};

export const formatFigure = (value: number | null | undefined): string =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "unknown";

export const formatPhone = (value?: string): string => {
  if (!value) return "Phone unavailable";
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : value;
};

export const parseContacts = (raw: string | null, facilities: Facility[]): Contacts => {
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid local contact record");
  const validIds = new Set(facilities.map(row => row.id));
  const entries: Contacts = {};
  for (const [id, entry] of Object.entries(parsed)) {
    if (!validIds.has(id) || !entry || typeof entry !== "object") continue;
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.status === "string" && Object.hasOwn(contactLabels, candidate.status) &&
      typeof candidate.updatedAt === "string" && Number.isFinite(Date.parse(candidate.updatedAt))) {
      entries[id] = { status: candidate.status as Contacts[string]["status"], updatedAt: candidate.updatedAt };
    }
  }
  return entries;
};

export const createCsv = (snapshot: Snapshot, contacts: Contacts): string => {
  const cell = (value: unknown): string => {
    const text = String(value ?? "");
    return `"${(/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
  };
  const header = ["Rank", "CCN", "Facility", "Type", "Phone", "Address", "ZIP", "Score (0–1)", "Contact status", "Recorded at UTC",
    ...snapshot.facilities[0]?.score.terms.map(term => `${term.name} weighted`) ?? [],
    "Snapshot generated UTC", "Source snapshot SHA256", "Data access", "Scenario", "Location review required", "Reason",
    "Zetaris query IDs", "Source artifact SHA256", "Data-quality outcomes", "Model record"];
  const rows = snapshot.facilities.map(row => [row.rank, row.ccn, row.name, row.type, row.phone.value, row.address, row.zip,
    row.score.total, contactLabels[contacts[row.id]?.status ?? "uncontacted"], contacts[row.id]?.updatedAt ?? "",
    ...row.score.terms.map(term => term.weighted), snapshot.generated_at, snapshot.source_snapshot_hash,
    snapshot.data_access.data_access_mode, `${snapshot.scenario.event} ${snapshot.scenario.warning_year} ${snapshot.scenario.mode}`,
    row.evidence.operator_geocode_review_required, row.computed_reason,
    row.evidence.zetaris_query_ids.join(";"), row.evidence.source_sha256,
    JSON.stringify(row.evidence.dq_results), JSON.stringify(row.evidence.model_explanation)]);
  return "\uFEFF" + [header, ...rows].map(row => row.map(cell).join(",")).join("\r\n");
};

export const hasCoordinates = (row: Facility): row is Facility & { lon: number; lat: number } =>
  typeof row.lon === "number" && typeof row.lat === "number" && Number.isFinite(row.lon) &&
  Number.isFinite(row.lat) && Math.abs(row.lon) <= 180 && Math.abs(row.lat) < 85;

export const createProjection = (geometry: Geometry, facilities: Facility[], scope: "coverage" | "facilities") => {
  const mercator = ([lon, lat]: Coordinate): Coordinate => [
    lon * Math.PI / 180,
    Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, lat)) * Math.PI / 360)),
  ];
  const facilityPoints: Coordinate[] = facilities.filter(hasCoordinates).map(row => [row.lon, row.lat]);
  const points = (scope === "facilities" && facilityPoints.length ? facilityPoints : [
    ...geometry.coordinates.flat(2), ...facilityPoints,
  ]).map(mercator);
  if (!points.length) return {
    project: (): Coordinate => [300, 200],
    unproject: (): Coordinate => [Number.NaN, Number.NaN],
    paths: [] as string[],
  };
  const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
  const minX = xs.reduce((a, b) => Math.min(a, b), Infinity), maxX = xs.reduce((a, b) => Math.max(a, b), -Infinity);
  const minY = ys.reduce((a, b) => Math.min(a, b), Infinity), maxY = ys.reduce((a, b) => Math.max(a, b), -Infinity);
  const scale = Math.min(520 / Math.max(maxX - minX, 0.00001), 310 / Math.max(maxY - minY, 0.00001));
  const project = (point: Coordinate): Coordinate => {
    const [x, y] = mercator(point);
    return [300 + (x - (minX + maxX) / 2) * scale, 200 - (y - (minY + maxY) / 2) * scale];
  };
  const paths = geometry.coordinates.map(polygon => polygon.map(ring =>
    ring.map((point, i) => `${i === 0 ? "M" : "L"}${project(point).map(n => n.toFixed(2)).join(",")}`).join(" ") + " Z",
  ).join(" "));
  const unproject = ([x, y]: Coordinate): Coordinate => {
    const rawX = (x - 300) / scale + (minX + maxX) / 2;
    const rawY = (200 - y) / scale + (minY + maxY) / 2;
    return [rawX * 180 / Math.PI, (2 * Math.atan(Math.exp(rawY)) - Math.PI / 2) * 180 / Math.PI];
  };
  return { project, unproject, paths };
};
