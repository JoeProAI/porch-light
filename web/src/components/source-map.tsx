import Link from "next/link";

const layers = [
  {
    name: "Census catalog",
    detail: "Official counties and county-equivalents. Search by name, state, or FIPS. Being on the list is not a ranking.",
  },
  {
    name: "CMS listings",
    detail: "Nursing homes and dialysis centers, with directory phones. Closed-source rows stay refused.",
  },
  {
    name: "Census geography",
    detail: "Address geocodes and tract geography. Non-exact matches stay marked. Points are not treated as verified operating locations.",
  },
  {
    name: "CDC SVI",
    detail: "Tract vulnerability context. Missing or suppressed values stay missing.",
  },
  {
    name: "HHS emPOWER",
    detail: "ZIP-level medical-equipment context. ZIP totals are not a count of this facility's patients.",
  },
  {
    name: "National Weather Service",
    detail: "Official alerts. A county highlight uses SAME FIPS already in the catalog. Storm Watch is weather, not national facility coverage.",
  },
];

export const SourceMap = ({ compact = false }: { compact?: boolean }) => (
  <section className={compact ? "source-map source-map-compact" : "source-map"} id="source-map" aria-labelledby="source-map-title">
    <div className="source-map-intro">
      <p className="eyebrow">Source stack / Any US county</p>
      <h2 id="source-map-title">How sources work for every county.</h2>
      <p>Porch Light is a nationwide desk. The same public sources are joined for any US county. Gaps stay visible. Nothing is filled in from another county.</p>
    </div>
    <ul className="source-map-layers">{layers.map(layer => (
      <li key={layer.name}>
        <h3>{layer.name}</h3>
        <p>{layer.detail}</p>
      </li>
    ))}</ul>
    <p className="source-map-join">Joins run as audited Zetaris SQL. Match rates come from those counts, not from a model. Each sheet carries its query ids. Cached files keep a provenance sidecar: source URL, fetched_at UTC, SHA-256, and license. Every catalog county has been source-audited. Drafts are in progress on free Nemotron routes. Not every county has an accepted draft. An operator can open any published county that has ranked facilities.</p>
    <p className="source-map-limit">No offline DGX, H-MEM, or World Model claim. Directory records, not verified facility conditions. An empty county stays empty. No Manatee substitute.</p>
    <Link className="source-map-cta" href="/nationwide#county-catalog">Pick a US county to open its sheet</Link>
  </section>
);
