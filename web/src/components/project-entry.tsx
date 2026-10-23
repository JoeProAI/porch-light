import Link from "next/link";
import { createProjection, formatPhone, hasCoordinates } from "@/lib/operator";
import type { Snapshot } from "@/lib/types";
import { HeroFilm } from "./hero-film";
import { LogoMark } from "./logo-mark";
import { ResourceLinks } from "./resource-links";
import { SponsorEvidence } from "./sponsor-evidence";
import { WatchBezel } from "./watch-bezel";

export const ProjectEntry = ({ snapshot }: { snapshot: Snapshot }) => {
  const first = snapshot.facilities[0];
  const dialysis = snapshot.facilities.filter(row => row.type === "dialysis").length;
  const nursing = snapshot.facilities.filter(row => row.type !== "dialysis").length;
  const { project, paths } = createProjection(snapshot.warning_geometry, snapshot.facilities, "facilities");
  return (
    <div className="project-entry">
      <a className="skip-link" href="#project-purpose">Skip to project purpose</a>
      <header className="entry-header">
        <Link className="wordmark" href="/"><LogoMark />Porch Light<span className="wordmark-period">.</span></Link>
        <span className="entry-category">Emergency operations</span>
        <nav aria-label="Project navigation"><a href="#workflow">How it works</a><Link href="/watch">Storm Watch</Link><Link href="/operate">Call sheet</Link></nav>
      </header>
      <main>
        <section className="mission" id="project-purpose" aria-labelledby="mission-title">
          <div className="storm-photo">
            <HeroFilm />
          </div>
          <div className="mission-copy">
            <p className="eyebrow mission-kicker">Storm preparedness / Care facilities</p>
            <h1 id="mission-title">Storm warning.<br /><em>Clear first call.</em></h1>
            <p className="mission-description">An emergency-operations call sheet for dialysis centers and nursing homes in a storm-warning area. Real phone numbers. A transparent order of outreach. Evidence behind every priority.</p>
            <Link className="entry-primary" href="/operate">Open the Manatee call sheet <span aria-hidden="true">↗</span></Link>
            <Link className="entry-secondary" href="/nationwide">Run a US county or captured live alert</Link>
            <p className="mission-limit">Verified example: Hurricane Milton, 2024. Retrospective, not a live warning or current facility conditions.</p>
            <a className="mission-sponsor-proof" href="#sponsor-title">Built with Zetaris, Meterless and NVIDIA Nemotron. <span>Inspect the proof.</span></a>
            <Link className="watch-entry-link" href="/watch">For current official weather, open Storm Watch</Link>
          </div>
          <aside className="first-call-preview" aria-label="Real first facility in the demonstration">
            <div className="preview-heading"><span className="eyebrow">Inside the call sheet</span><span className="preview-number">{first ? String(first.rank).padStart(2, "0") : "None eligible"}</span></div>
            {first ? <>
              <p className="preview-type">{first.type === "dialysis" ? "Dialysis center" : "Nursing home"} / Manatee County, FL</p>
              <h2>{first.name}</h2>
              <p className="preview-phone">{formatPhone(first.phone.value)}</p>
              <p className="preview-context">First in this prototype snapshot. Inspect its source records and score before acting.</p>
              <WatchBezel label="Open a ranked facility on the call sheet" ticks={snapshot.facilities.map(item => ({ id: item.id, label: `Open rank ${item.rank}, ${item.name}`, mark: String(item.rank), href: `/operate?rank=${item.rank}` }))}
                selectedId={first.id} centerHref={`/operate?rank=${first.rank}`} centerLabel={`Open rank ${first.rank}, ${first.name}`} centerMark={String(first.rank).padStart(2, "0")} />
              <div className="preview-map" aria-label="Actual facility and warning-zone geometry">
                <svg viewBox="0 0 600 400" role="img" aria-label="Published NWS zone shapes and real facility source points">
                  <defs><clipPath id="entry-map-clip"><rect width="600" height="400" /></clipPath></defs>
                  <g clipPath="url(#entry-map-clip)">
                    {paths.map((d, i) => <path key={i} d={d} className="entry-zone" fillRule="evenodd" />)}
                    {snapshot.facilities.filter(hasCoordinates).map(row => {
                      const [cx, cy] = project([row.lon, row.lat]);
                      return <circle key={row.id} cx={cx} cy={cy} r={row.rank === 1 ? 12 : 5} className={row.rank === 1 ? "entry-pin active" : "entry-pin"} />;
                    })}
                  </g>
                </svg>
                <span>Source geometry, not live radar. Location review required.</span>
              </div>
            </> : <p>No eligible facilities in this snapshot. Open the call sheet to inspect the source refusals.</p>}
          </aside>
          <p className="satellite-credit">Demonstration: Hurricane Milton, October 8, 2024. The picture is project key art of a night storm and one porch light. It is not a NASA satellite image and not a live warning.</p>
        </section>
        <section className="demonstration-scope" aria-label="What this example contains">
          <div><span className="eyebrow">One real warning area</span><h2>Manatee County,<br />Florida.</h2></div>
          <p><strong>{dialysis}</strong> ranked dialysis centers</p>
          <p><strong>{nursing}</strong> ranked nursing homes</p>
          <p><strong>{snapshot.refused.length}</strong> refused source records</p>
          <span className="scope-note">The demonstration is local and retrospective. Nationwide and international coverage aren't claimed by this example.</span>
        </section>
        <section className="project-workflow" id="workflow" aria-labelledby="workflow-title">
          <div className="workflow-intro"><p className="eyebrow">From warning to outreach</p><h2 id="workflow-title">Less searching.<br />A call sheet you can inspect.</h2><p>Porch Light brings fragmented public records into one working order. It doesn't decide clinical urgency, place calls or invent missing evidence.</p></div>
          <ol className="workflow-chain">
            <li><img src="/art/section-01-warning-in.jpg" alt="Storm clouds and rain over a dark street, the warning coming in." /><span>01</span><div><h3>Locate the warning.</h3><p>An archived weather warning and its published map define this demonstration.</p></div></li>
            <li><img src="/art/section-02-evidence.jpg" alt="A dim interior with papers and a single warm lamp, the evidence desk." /><span>02</span><div><h3>Find the care facilities.</h3><p>Medicare care-facility records, listed phone numbers, and linked public context. Records that don't match stay visible.</p></div></li>
            <li><img src="/art/section-03-call-first.jpg" alt="Four porch lights along a dark street. The nearest is bright. The others dim toward the distance." /><span>03</span><div><h3>Inspect the call order.</h3><p>A fixed formula ranks the rows. Nemotron writes grounded drafts, never the ranking.</p></div></li>
            <li><span>04</span><div><h3>Record contact. Export.</h3><p>Save a manual outcome on this device, move to the next uncontacted facility, print or export.</p></div></li>
          </ol>
        </section>
        <SponsorEvidence snapshot={snapshot} />
        <ResourceLinks />
      </main>
      <footer className="entry-footer"><Link className="wordmark" href="/">Porch Light.</Link><p>Prototype policy, not clinically validated. No emergency or clinical guidance. No calls are placed.</p><span className="mono">Real source records. Visible limits.</span></footer>
    </div>
  );
};
