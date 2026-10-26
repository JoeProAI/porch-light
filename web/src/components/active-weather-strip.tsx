import Link from "next/link";
import { isAffectedAlert } from "@/lib/affected-alerts";
import { formatDateEt } from "@/lib/operator";
import { publicWeather, readLiveWeather } from "@/lib/weather-server";

export const ActiveWeatherStrip = async () => {
  try {
    const weather = publicWeather(await readLiveWeather());
    const actual = weather.alerts.filter(alert => alert.status === "Actual").length;
    const affected = weather.alerts.filter(isAffectedAlert).length;
    return <section className="active-weather-strip" aria-label="Active weather">
      <p><span className="eyebrow">Active weather</span> {actual} Actual. {affected} severe, extreme, or warnings. <time dateTime={weather.captured_at}>{formatDateEt(weather.captured_at)}</time>.</p>
      <Link href="/nationwide">See affected areas</Link>
      <Link href="/watch">Open Storm Watch</Link>
    </section>;
  } catch {
    return <section className="active-weather-strip" aria-label="Active weather">
      <p><span className="eyebrow">Active weather</span> The National Weather Service feed could not be read. No alert count is shown.</p>
      <Link href="/nationwide">Open the county catalog</Link>
      <Link href="/watch">Open Storm Watch</Link>
    </section>;
  }
};
