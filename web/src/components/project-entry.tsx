import Link from "next/link";
import type { Snapshot } from "@/lib/types";
import { HeroFilm } from "./hero-film";
import { Masthead } from "./masthead";
import { ResourceLinks } from "./resource-links";
import { SponsorEvidence } from "./sponsor-evidence";

export const ProjectEntry = ({ snapshot }: { snapshot: Snapshot }) => {
  return (
    <div className="project-entry">
      <a className="skip-link" href="#project-purpose">Skip to project purpose</a>
      <Masthead />
      <main>
        <section className="mission" id="project-purpose" aria-labelledby="mission-title">
          <div className="storm-photo">
            <HeroFilm />
          </div>
          <div className="mission-copy">
            <p className="eyebrow mission-kicker">Storm preparedness / Any US county</p>
            <h1 id="mission-title">Storm warning.<br /><em>Clear first call.</em></h1>
            <p className="mission-description">An emergency-operations call sheet for dialysis centers and nursing homes in any US county. Real phone numbers from that run. A transparent order of outreach. Evidence behind every priority.</p>
            <Link className="entry-primary" href="/nationwide">Pick any US county <span aria-hidden="true">↗</span></Link>
            <p className="mission-limit">One county per run, or the counties a captured weather alert maps. Verified local runs, with gaps left visible. Drafts are in progress. This page is not a live warning or current facility conditions.</p>
            <a className="mission-sponsor-proof" href="#sponsor-title">Built with Zetaris, Meterless and NVIDIA Nemotron. <span>Inspect the proof.</span></a>
            <Link className="watch-entry-link" href="/watch">For current official weather, open Storm Watch</Link>
          </div>
          <p className="satellite-credit">The picture is project key art of a night storm and one porch light. It is not a satellite image and not a live warning.</p>
        </section>
        <section className="demonstration-scope" aria-labelledby="product-scope-title">
          <div><span className="eyebrow">Nationwide</span><h2 id="product-scope-title">Any US county.</h2></div>
          <ul className="product-points">
            <li><h3>One county, one run.</h3><p>Search the Census catalog or pick the county on the map.</p></li>
            <li><h3>A fixed call order.</h3><p>The published formula ranks the rows. Nemotron writes the reason.</p></li>
            <li><h3>Gaps stay visible.</h3><p>Records that do not join stay on the sheet. Nothing is filled in.</p></li>
          </ul>
          <span className="scope-note">A captured weather alert can run the counties it maps. Drafts are in progress on free Nemotron routes. A live run needs the local audited data connection. Directory records, not verified facility conditions.</span>
        </section>
        <section className="project-workflow" id="workflow" aria-labelledby="workflow-title">
          <div className="workflow-intro"><p className="eyebrow">From county to outreach</p><h2 id="workflow-title">Less searching.<br />A call sheet you can inspect.</h2><p>Porch Light brings fragmented public records into one working order. It does not decide clinical urgency, place calls or invent missing evidence.</p></div>
          <ol className="workflow-chain">
            <li><img src="/art/section-01-warning-in.jpg" alt="Storm clouds and rain over a dark street, the warning coming in." /><span>01</span><div><h3>Choose the county.</h3><p>A Census county, or a captured weather alert and the counties it maps, starts the sheet.</p></div></li>
            <li><img src="/art/section-02-evidence.jpg" alt="A dim interior with papers and a single warm lamp, the evidence desk." /><span>02</span><div><h3>Find the care facilities.</h3><p>Medicare care-facility records, listed phone numbers, and linked public context. Records that do not match stay visible.</p></div></li>
            <li><img src="/art/section-03-call-first.jpg" alt="Four porch lights along a dark street. The nearest is bright. The others dim toward the distance." /><span>03</span><div><h3>Inspect the call order.</h3><p>A fixed formula ranks the rows. Nemotron writes grounded drafts, never the ranking.</p></div></li>
            <li><span>04</span><div><h3>Record contact. Export.</h3><p>Save a manual outcome on this device, move to the next uncontacted facility, print or export.</p></div></li>
          </ol>
        </section>
        <SponsorEvidence snapshot={snapshot} />
        <ResourceLinks />
      </main>
      <footer className="entry-footer"><Link className="wordmark" href="/">Porch Light.</Link><p>Prototype policy, not clinically validated. No emergency or clinical guidance. No calls are placed.</p><span className="mono">Real source records. Visible limits.</span><Link className="retrospective-link" href="/operate">Hurricane Milton retrospective</Link></footer>
    </div>
  );
};
