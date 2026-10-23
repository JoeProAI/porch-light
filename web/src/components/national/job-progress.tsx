import { looksUnreachable, UNREACHABLE_MESSAGE } from "@/lib/national-gaps";

export type NationalJob = {
  id: string; phase: string; message?: string;
  completed_counties?: number; total_counties?: number; eligible_facilities?: number;
};

const PHASES: Record<string, string> = {
  starting: "Starting the audited job",
  checking_saved_run: "Checking the saved run",
  querying_sources: "Reading CMS, Census, SVI and emPOWER through Zetaris",
  querying_alert_counties: "Reading counties mapped to this alert",
  grounding_nemotron_drafts: "Requesting grounded Nemotron drafts for the ranked rows",
  completed: "Call sheet ready",
  failed: "The job failed",
};

export const JobProgress = ({ job }: { job: NationalJob }) => {
  const unreachable = !!job.message && looksUnreachable(job.message);
  return <section className="source-strip" role="status" aria-live="polite">
    {unreachable && <h2>{UNREACHABLE_MESSAGE}</h2>}
    <p>{PHASES[job.phase] ?? job.phase.replaceAll("_", " ")}. Run {job.id}.
      {job.total_counties !== undefined && <> {job.completed_counties ?? 0} of {job.total_counties} affected counties read.</>}
      {job.eligible_facilities !== undefined && <> {job.eligible_facilities} source-eligible facilities.</>}
    </p>
    {job.message && <p role="alert">{job.message} No source or model fallback was fabricated.</p>}
  </section>;
};
