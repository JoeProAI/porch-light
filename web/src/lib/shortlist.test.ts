import assert from "node:assert/strict";
import test from "node:test";
import { alertsForCounty, readSheetSummary, SHORTLIST_CAP, shortlistCsv, toggleShortlist } from "./shortlist.ts";

test("shift-style adds and a plain click keeps one county", () => {
  assert.deepEqual(toggleShortlist([], "35015", false), ["35015"]);
  assert.deepEqual(toggleShortlist(["35015"], "35009", true), ["35015", "35009"]);
  assert.deepEqual(toggleShortlist(["35015", "35009"], "35009", true), ["35015"]);
  assert.deepEqual(toggleShortlist(["35015", "35009"], "35037", false), ["35037"]);
  assert.deepEqual(toggleShortlist(["35015"], "note", true), ["35015"]);
});

test("the shortlist stops at the cap", () => {
  const full = Array.from({ length: SHORTLIST_CAP }, (_, index) => String(10000 + index).padStart(5, "0"));
  assert.equal(toggleShortlist(full, "35015", true).length, SHORTLIST_CAP);
  assert.deepEqual(toggleShortlist(full, "35015", false), ["35015"]);
});

test("export lists SAME alert names and does not read area text", () => {
  const csv = shortlistCsv([{
    fips: "35015",
    name: "Eddy",
    state: "NM",
    alerts: alertsForCounty("35015", [
      { event: "Flood Warning", same_county_fips: ["35015"], areaDesc: "Eddy, NM" },
      { event: "Gale Warning", same_county_fips: ["58850"], areaDesc: "Eddy, NM" },
    ] as { event: string; same_county_fips: string[] }[]),
  }]);
  assert.equal(csv, "fips,name,state,alerts\n35015,Eddy,NM,Flood Warning\n");
});

test("a published sheet summary keeps ranked rows and drops missing phones", () => {
  const summary = readSheetSummary({
    phase: "completed",
    snapshot: {
      county: { name: "Eddy", fips: "35015", state: "NM" },
      counts: { ranked_rows: 2, refused_rows: 1 },
      facilities: [
        { name: "Artesia", rank: 1, phone: { value: "575-555-0100" } },
        { name: "No phone", rank: 2, phone: { status: "missing" } },
      ],
    },
  });
  assert.equal(summary?.ranked, 2);
  assert.equal(summary?.facilities[0]?.phone, "575-555-0100");
  assert.equal(summary?.facilities[1]?.phone, null);
  assert.equal(readSheetSummary({ phase: "failed" }), null);
});
