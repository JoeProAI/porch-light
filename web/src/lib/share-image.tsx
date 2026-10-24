import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import projectDirection from "../../design/project-direction.json";

export const renderShareImage = async (): Promise<Response> => {
  const [displayFont, bodyFont] = await Promise.all([
    readFile(path.join(process.cwd(), "node_modules/@fontsource/libre-baskerville/files/libre-baskerville-latin-400-normal.woff")),
    readFile(path.join(process.cwd(), "node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff")),
  ]);
  const colors = projectDirection.tokens;
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: colors.background, color: colors.text, padding: "48px 64px 40px", fontFamily: "OptimaStudy", borderLeft: `24px solid ${colors.accent}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "BaskervilleStudy", fontSize: 36, letterSpacing: "-2px" }}>Porch Light.</span>
        <span style={{ fontSize: 16, letterSpacing: "2px", color: colors.accent }}>ANY US COUNTY</span>
      </div>
      <span style={{ fontFamily: "BaskervilleStudy", fontSize: 76, letterSpacing: "-3px", lineHeight: 1.05, marginTop: 72 }}>Pick any US county.</span>
      <span style={{ fontSize: 28, lineHeight: 1.45, maxWidth: 920, marginTop: 28 }}>Dialysis centers and nursing homes. A fixed outreach order. Source gaps stay on the sheet.</span>
      <div style={{ display: "flex", marginTop: "auto", gap: 22, fontSize: 20, color: colors.muted }}>
        <span>One county, one run</span>
        <span style={{ color: colors.accent }}>/</span>
        <span>Fixed formula ranks</span>
        <span style={{ color: colors.accent }}>/</span>
        <span>Gaps stay visible</span>
      </div>
    </div>,
    { width: 1200, height: 630, fonts: [
      { name: "BaskervilleStudy", data: displayFont, weight: 400, style: "normal" },
      { name: "OptimaStudy", data: bodyFont, weight: 400, style: "normal" },
    ] },
  );
};
