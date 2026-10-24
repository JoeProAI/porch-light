import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readSnapshot } from "./snapshot";
import { createProjection, hasCoordinates } from "./operator";
import projectDirection from "../../design/project-direction.json";

export const renderShareImage = async (): Promise<Response> => {
  const [{ snapshot }, displayFont, bodyFont, stormImage] = await Promise.all([
    readSnapshot(),
    readFile(path.join(process.cwd(), "node_modules/@fontsource/libre-baskerville/files/libre-baskerville-latin-400-normal.woff")),
    readFile(path.join(process.cwd(), "node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff")),
    readFile(path.join(process.cwd(), "public/weather/milton-2024-nasa.jpg")),
  ]);
  const { project, paths } = createProjection(snapshot.warning_geometry, snapshot.facilities, "facilities");
  const colors = projectDirection.tokens;
  const audited = snapshot.data_access.data_access_mode === "zetaris";
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: colors.background, color: colors.text, padding: "36px 48px 30px 78px", fontFamily: "OptimaStudy", borderLeft: `24px solid ${colors.surface}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 22, borderBottom: `1px solid ${colors.muted}` }}>
        <span style={{ fontFamily: "BaskervilleStudy", fontSize: 32, letterSpacing: "-2px" }}>Porch Light.</span>
        <span style={{ fontSize: 17, letterSpacing: "2px", color: colors.accent }}>STORM WARNING / CARE FACILITIES</span>
      </div>
      <div style={{ display: "flex", flex: 1, paddingTop: 32, gap: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", width: 540 }}>
          <span style={{ fontSize: 14, color: colors.muted, letterSpacing: "2px" }}>HURRICANE MILTON / RETROSPECTIVE 2024</span>
          <span style={{ fontFamily: "BaskervilleStudy", fontSize: 52, letterSpacing: "-3px", lineHeight: 1.15, marginTop: 24, marginBottom: 14 }}>Storm warning. Clear first call.</span>
          <span style={{ fontSize: 23, color: colors.accent, marginBottom: 24 }}>Dialysis centers. Nursing homes. A sourced call sheet.</span>
          {snapshot.facilities.slice(0, 3).map(row => (
            <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 16, borderTop: `1px solid ${colors.surface}`, padding: "14px 0", color: row.rank === 1 ? colors.accent : colors.text }}>
              <span style={{ fontSize: 23, width: 30 }}>{String(row.rank).padStart(2, "0")}</span>
              <span style={{ fontSize: 16, flex: 1 }}>{row.name}</span>
              <span style={{ fontSize: 18 }}>{row.score.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: 440, borderLeft: `1px solid ${colors.muted}`, paddingLeft: 24 }}>
          <span style={{ color: colors.accent, fontSize: 15, marginBottom: 14 }}>HURRICANE MILTON / NASA / OCT 8, 2024</span>
          <img src={`data:image/jpeg;base64,${stormImage.toString("base64")}`} width={408} height={170} style={{ width: 408, height: 170, objectFit: "cover", flexShrink: 0 }} alt="Archived NASA satellite image of Hurricane Milton" />
          <svg width="408" height="110" viewBox="0 0 600 400" style={{ background: colors.surface, marginTop: 12, flexShrink: 0 }}>
            <defs><clipPath id="share-clip"><rect width="600" height="400" /></clipPath></defs>
            <g clipPath="url(#share-clip)">
              {paths.map((d, i) => <path key={i} d={d} fill={colors.background} fillRule="evenodd" stroke={colors.focus} strokeWidth="1.5" />)}
              {snapshot.facilities.filter(hasCoordinates).map(row => {
                const [cx, cy] = project([row.lon, row.lat]);
                return <circle key={row.id} cx={cx} cy={cy} r={row.rank === 1 ? 11 : 5} fill={row.rank === 1 ? colors.accent : colors.text} />;
              })}
            </g>
          </svg>
          <span style={{ marginTop: 18, fontSize: 20, color: colors.accent }}>{snapshot.counts.ranked_rows} ranked / {snapshot.counts.refused_rows} refused</span>
          <span style={{ marginTop: 10, fontSize: 16, lineHeight: 1.4, color: colors.muted }}>Actual source geometry. Not live radar or current conditions.</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, paddingTop: 18, borderTop: `1px solid ${colors.muted}`, color: colors.muted }}>
        <span>{audited ? `Zetaris audit ${snapshot.data_access.zetaris_query_ids.join(", ")}` : "Development data"} / Prototype, not clinical guidance</span>
        <span>SNAPSHOT {snapshot.generated_at.slice(0, 10)}</span>
      </div>
    </div>,
    { width: 1200, height: 630, fonts: [
      { name: "BaskervilleStudy", data: displayFont, weight: 400, style: "normal" },
      { name: "OptimaStudy", data: bodyFont, weight: 400, style: "normal" },
    ] },
  );
};
