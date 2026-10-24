import { publicWeather, readLiveWeather } from "@/lib/weather-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async (): Promise<Response> => {
  try {
    return Response.json(publicWeather(await readLiveWeather()), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json({
      error: "The audited weather feed is unavailable. No substitute observations are shown.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
};
