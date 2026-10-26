let downUntil = 0;

export const weatherSourceMode = (): "auto" | "public" | "zetaris" => {
  const value = process.env.PORCHLIGHT_WEATHER_SOURCE;
  if (value === "public" || value === "zetaris") return value;
  return "auto";
};

/** Skip the local Python/Zetaris weather path. Hosted Vercel has neither. */
export const skipAuditedEngine = (): boolean => {
  if (weatherSourceMode() === "zetaris") return false;
  if (weatherSourceMode() === "public" || process.env.VERCEL === "1") return true;
  return Date.now() < downUntil;
};

export const auditedEngineRequired = (): boolean => weatherSourceMode() === "zetaris";

export const markAuditedEngineDown = (): void => {
  downUntil = Date.now() + 60_000;
};
