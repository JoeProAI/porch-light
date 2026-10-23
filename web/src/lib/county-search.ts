export type CountyRecord = { fips: string; name: string; state: string; geometry_valid?: boolean };

const normalize = (value: string): string => value.normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export const searchCounties = (counties: CountyRecord[], query: string): CountyRecord[] => {
  const terms = normalize(query).split(/\s+/).filter(term => term && !["county", "parish", "borough"].includes(term));
  if (!terms.length) return [];
  return counties.filter(county => {
    const source = normalize(`${county.name} ${county.state} ${county.fips}`);
    return terms.every(term => source.includes(term));
  });
};
