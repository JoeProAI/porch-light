import { publicWeather, readLiveWeather } from "@/lib/weather-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async (): Promise<Response> => {
  try {
    const weather = publicWeather(await readLiveWeather());
    const hosted = weather.data_access.data_access_mode === "public_nws";
    return Response.json(weather, {
      headers: {
        "Cache-Control": hosted ? "public, max-age=30" : "private, no-store",
        "X-Porchlight-Data-Access": weather.data_access.data_access_mode,
      },
    });
  } catch {
    return Response.json({
      error: "The audited weather feed is unavailable. No substitute observations are shown.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
};
