import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readSnapshot } from "./snapshot";
import { createProjection, hasCoordinates } from "./operator";

export const renderShareImage = async (): Promise<Response> => {
  const [{ snapshot }, displayFont, bodyFont] = await Promise.all([
    readSnapshot(),
    readFile(path.join(process.cwd(), "node_modules/@fontsource/fraunces/files/fraunces-latin-400-normal.woff")),
    readFile(path.join(process.cwd(), "node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff")),
  ]);
  const { project, paths } = createProjection(snapshot.warning_geometry, snapshot.facilities, "facilities");
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#101b20", color: "#f0ecdf", padding: "40px 52px", fontFamily: "Plex" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 22, borderBottom: "1px solid #3c4b50" }}>
        <span style={{ fontFamily: "Fraunces", fontSize: 36, letterSpacing: "-2px" }}>Porch Light.</span>
        <span style={{ fontSize: 15, letterSpacing: "2px", color: "#afbbbd" }}>MANATEE / FL · MILTON 2024</span>
      </div>
      <div style={{ display: "flex", flex: 1, paddingTop: 28, gap: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", width: 640 }}>
          <span style={{ fontSize: 13, color: "#e8b66d", letterSpacing: "2px" }}>RETROSPECTIVE / CALL-FIRST LEDGER</span>
          <span style={{ fontFamily: "Fraunces", fontSize: 69, letterSpacing: "-4px", lineHeight: 1.05, marginTop: 20, marginBottom: 25 }}>Know who to call first.</span>
          {snapshot.facilities.slice(0, 3).map(row => (
            <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 16, borderTop: "1px solid #3c4b50", padding: "14px 0", color: row.rank === 1 ? "#e8b66d" : "#f0ecdf" }}>
              <span style={{ fontSize: 18, width: 26 }}>{String(row.rank).padStart(2, "0")}</span>
              <span style={{ fontSize: 16, flex: 1 }}>{row.name}</span>
              <span style={{ fontSize: 18 }}>{row.score.total.toFixed(4)}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: 360, borderLeft: "1px solid #3c4b50", paddingLeft: 24 }}>
          <span style={{ color: "#afbbbd", fontSize: 13, marginBottom: 12 }}>ACTUAL SOURCE GEOGRAPHY</span>
          <svg width="336" height="255" viewBox="0 0 600 400" style={{ background: "#17272c" }}>
            <defs><clipPath id="share-clip"><rect width="600" height="400" /></clipPath></defs>
            <g clipPath="url(#share-clip)">
              {paths.map((d, i) => <path key={i} d={d} fill="#1d3034" fillRule="evenodd" stroke="#79938a" strokeWidth="1.5" />)}
              {snapshot.facilities.filter(hasCoordinates).map(row => {
                const [cx, cy] = project([row.lon, row.lat]);
                return <circle key={row.id} cx={cx} cy={cy} r={row.rank === 1 ? 9 : 5} fill={row.rank === 1 ? "#e8b66d" : "#d1d5cb"} />;
              })}
            </g>
          </svg>
          <span style={{ marginTop: 18, fontSize: 16, color: "#e8b66d" }}>{snapshot.counts.ranked_rows} ranked · {snapshot.counts.refused_rows} refused</span>
          <span style={{ marginTop: 10, fontSize: 14, lineHeight: 1.5, color: "#afbbbd" }}>Current zone shapes. Location review required. Not live radar or current conditions.</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 18, borderTop: "1px solid #3c4b50", color: "#afbbbd" }}>
        <span>Development PostGIS · Zetaris pending · Not clinical guidance</span>
        <span>SNAPSHOT {snapshot.generated_at.slice(0, 10)}</span>
      </div>
    </div>,
    { width: 1200, height: 630, fonts: [
      { name: "Fraunces", data: displayFont, weight: 400, style: "normal" },
      { name: "Plex", data: bodyFont, weight: 400, style: "normal" },
    ] },
  );
};
