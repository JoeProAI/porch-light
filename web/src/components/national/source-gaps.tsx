import { nationalQueryIds, sourceGaps } from "@/lib/national-gaps";

export const SourceGaps = ({ value }: { value: unknown }) => {
  const gaps = sourceGaps(value);
  const ids = nationalQueryIds(value);
  if (!gaps.length && !ids.length) return null;
  return <section className="national-gaps" aria-label="Source gaps and audit evidence">
    <h2>Source gaps</h2>
    <ul>{gaps.map(gap => <li key={`${gap.source}:${gap.text}`}>
      <span className="gap-source">{gap.source}</span>
      <strong>{gap.text}</strong>
      {gap.detail && <p className="fineprint">{gap.detail}</p>}
    </li>)}</ul>
    {ids.length > 0 && <p className="fineprint">Zetaris query IDs <code>{ids.join(", ")}</code>.</p>}
  </section>;
};
