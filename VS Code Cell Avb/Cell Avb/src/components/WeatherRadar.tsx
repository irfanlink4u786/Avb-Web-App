import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Cloud,
  CloudRain,
  CloudDrizzle,
  CloudSnow,
  CloudLightning,
  Sun,
  CloudSun,
  CloudFog,
  Wind,
  Droplets,
  Thermometer,
  Eye,
  Gauge,
  AlertTriangle,
  RefreshCw,
  MapPin,
  Sunrise,
  Sunset,
  Umbrella,
  Zap,
  TrendingUp,
} from "lucide-react";

interface CityWeather {
  name: string;
  lat: number;
  lon: number;
  current: {
    temperature: number;
    apparentTemp: number;
    humidity: number;
    precipitation: number;
    rain: number;
    weatherCode: number;
    windSpeed: number;
    windDir: number;
    windGusts: number;
    isDay: boolean;
  };
  hourly: {
    time: string[];
    precipitationProb: number[];
    precipitation: number[];
    windSpeed: number[];
    windGusts: number[];
    weatherCode: number[];
  };
  daily: {
    time: string[];
    weatherCodeMax: number[];
    precipitationSum: number[];
    windSpeedMax: number[];
    windGustsMax: number[];
    tempMax: number[];
    tempMin: number[];
    sunrise: string[];
    sunset: string[];
  };
  alerts: WeatherAlert[];
}

interface WeatherAlert {
  type: "rain" | "windstorm" | "thunderstorm" | "heat" | "fog";
  severity: "low" | "medium" | "high";
  title: string;
  message: string;
  time: string;
}

const CITIES = [
  { name: "Lahore", lat: 31.5204, lon: 74.3587 },
  { name: "Sheikhupura", lat: 31.7131, lon: 73.9783 },
  { name: "Kasur", lat: 31.1156, lon: 74.4489 },
];

// WMO weather code mapping
function weatherInfo(code: number, isDay: boolean = true): { label: string; icon: React.ReactNode; color: string } {
  const day = isDay;
  if (code === 0) return { label: "Clear Sky", icon: <Sun className={day ? "text-amber-400" : "text-slate-300"} />, color: "text-amber-400" };
  if (code === 1) return { label: "Mainly Clear", icon: <CloudSun className={day ? "text-amber-300" : "text-slate-300"} />, color: "text-amber-300" };
  if (code === 2) return { label: "Partly Cloudy", icon: <CloudSun className="text-slate-300" />, color: "text-slate-300" };
  if (code === 3) return { label: "Overcast", icon: <Cloud className="text-slate-400" />, color: "text-slate-400" };
  if (code === 45 || code === 48) return { label: "Fog", icon: <CloudFog className="text-slate-400" />, color: "text-slate-400" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", icon: <CloudDrizzle className="text-cyan-400" />, color: "text-cyan-400" };
  if (code >= 61 && code <= 67) return { label: "Rain", icon: <CloudRain className="text-blue-400" />, color: "text-blue-400" };
  if (code >= 71 && code <= 77) return { label: "Snow", icon: <CloudSnow className="text-slate-200" />, color: "text-slate-200" };
  if (code >= 80 && code <= 82) return { label: "Rain Showers", icon: <CloudRain className="text-blue-400" />, color: "text-blue-400" };
  if (code >= 85 && code <= 86) return { label: "Snow Showers", icon: <CloudSnow className="text-slate-200" />, color: "text-slate-200" };
  if (code >= 95 && code <= 99) return { label: "Thunderstorm", icon: <CloudLightning className="text-amber-400" />, color: "text-amber-400" };
  return { label: "Unknown", icon: <Cloud className="text-slate-400" />, color: "text-slate-400" };
}

function windDirToText(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function generateAlerts(data: {
  hourly: { precipitationProb: number[]; precipitation: number[]; windSpeed: number[]; windGusts: number[]; weatherCode: number[]; time: string[] };
  daily: { precipitationSum: number[]; windSpeedMax: number[]; windGustsMax: number[]; weatherCodeMax: number[]; time: string[] };
}): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  const now = new Date();
  const nowIdx = data.hourly.time.findIndex((t) => new Date(t) >= now);

  // Check next 24 hours for rain
  const next24Prob = data.hourly.precipitationProb.slice(Math.max(0, nowIdx), Math.max(0, nowIdx) + 24);
  const maxProb = Math.max(...next24Prob, 0);
  const rainHours = next24Prob.filter((p) => p >= 40).length;

  if (maxProb >= 70) {
    const idx = next24Prob.indexOf(maxProb);
    const alertTime = data.hourly.time[Math.max(0, nowIdx) + idx];
    alerts.push({
      type: "rain",
      severity: "high",
      title: "Heavy Rain Expected",
      message: `${maxProb}% chance of rain in the next 24 hours. ${rainHours} hours of significant precipitation expected. Prepare sites for potential power outages and water ingress.`,
      time: alertTime ? new Date(alertTime).toLocaleString("en-PK", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : "Soon",
    });
  } else if (maxProb >= 40) {
    const idx = next24Prob.indexOf(maxProb);
    const alertTime = data.hourly.time[Math.max(0, nowIdx) + idx];
    alerts.push({
      type: "rain",
      severity: "medium",
      title: "Rain Expected",
      message: `${maxProb}% chance of rain in the next 24 hours. Monitor outdoor sites and ensure weatherproofing is intact.`,
      time: alertTime ? new Date(alertTime).toLocaleString("en-PK", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : "Soon",
    });
  }

  // Check for windstorm
  const next24Wind = data.hourly.windSpeed.slice(Math.max(0, nowIdx), Math.max(0, nowIdx) + 24);
  const next24Gusts = data.hourly.windGusts.slice(Math.max(0, nowIdx), Math.max(0, nowIdx) + 24);
  const maxGust = Math.max(...next24Gusts, 0);
  const maxWind = Math.max(...next24Wind, 0);

  if (maxGust >= 60) {
    const idx = next24Gusts.indexOf(maxGust);
    const alertTime = data.hourly.time[Math.max(0, nowIdx) + idx];
    alerts.push({
      type: "windstorm",
      severity: "high",
      title: "Severe Windstorm Alert",
      message: `Wind gusts up to ${maxGust} km/h expected. Secure antennas, check tower integrity, and prepare for potential structural stress on outdoor sites.`,
      time: alertTime ? new Date(alertTime).toLocaleString("en-PK", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : "Soon",
    });
  } else if (maxGust >= 40) {
    const idx = next24Gusts.indexOf(maxGust);
    const alertTime = data.hourly.time[Math.max(0, nowIdx) + idx];
    alerts.push({
      type: "windstorm",
      severity: "medium",
      title: "Strong Winds Expected",
      message: `Wind gusts up to ${maxGust} km/h expected. Monitor tower-mounted equipment and antenna alignment.`,
      time: alertTime ? new Date(alertTime).toLocaleString("en-PK", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : "Soon",
    });
  }

  // Check for thunderstorm
  const next24Codes = data.hourly.weatherCode.slice(Math.max(0, nowIdx), Math.max(0, nowIdx) + 24);
  if (next24Codes.some((c) => c >= 95)) {
    const idx = next24Codes.findIndex((c) => c >= 95);
    const alertTime = data.hourly.time[Math.max(0, nowIdx) + idx];
    alerts.push({
      type: "thunderstorm",
      severity: "high",
      title: "Thunderstorm Warning",
      message: "Thunderstorm activity detected in the forecast. Risk of lightning strikes to towers and power fluctuations. Ensure surge protection is active.",
      time: alertTime ? new Date(alertTime).toLocaleString("en-PK", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : "Soon",
    });
  }

  return alerts;
}

function AlertCard({ alert }: { alert: WeatherAlert }) {
  const config = {
    rain: { icon: <CloudRain className="w-5 h-5" />, border: "border-blue-500/40", bg: "bg-blue-500/10", iconBg: "bg-blue-500/20 text-blue-400" },
    windstorm: { icon: <Wind className="w-5 h-5" />, border: "border-amber-500/40", bg: "bg-amber-500/10", iconBg: "bg-amber-500/20 text-amber-400" },
    thunderstorm: { icon: <CloudLightning className="w-5 h-5" />, border: "border-purple-500/40", bg: "bg-purple-500/10", iconBg: "bg-purple-500/20 text-purple-400" },
    heat: { icon: <Thermometer className="w-5 h-5" />, border: "border-red-500/40", bg: "bg-red-500/10", iconBg: "bg-red-500/20 text-red-400" },
    fog: { icon: <CloudFog className="w-5 h-5" />, border: "border-slate-500/40", bg: "bg-slate-500/10", iconBg: "bg-slate-500/20 text-slate-400" },
  };
  const c = config[alert.type];
  const sevColor = alert.severity === "high" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400";

  return (
    <div className={`border ${c.border} ${c.bg} rounded-lg p-4`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg ${c.iconBg} flex items-center justify-center shrink-0`}>
          {c.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-white font-semibold text-sm">{alert.title}</h4>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sevColor}`}>
              {alert.severity.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{alert.message}</p>
          <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Expected: {alert.time}
          </p>
        </div>
      </div>
    </div>
  );
}

function Clock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CityCard({ city }: { city: CityWeather }) {
  const w = weatherInfo(city.current.weatherCode, city.current.isDay);
  const now = new Date();
  const nowIdx = city.hourly.time.findIndex((t) => new Date(t) >= now);
  const next12Prob = city.hourly.precipitationProb.slice(Math.max(0, nowIdx), Math.max(0, nowIdx) + 12);
  const next12Times = city.hourly.time.slice(Math.max(0, nowIdx), Math.max(0, nowIdx) + 12).map((t) =>
    new Date(t).toLocaleString("en-PK", { hour: "2-digit", minute: "2-digit" })
  );

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      {/* City header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-bold text-white">{city.name}</h3>
        </div>
        <div className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${city.alerts.length > 0 ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
          <span className="text-[10px] text-slate-500">
            {city.alerts.length > 0 ? `${city.alerts.length} alert(s)` : "All clear"}
          </span>
        </div>
      </div>

      {/* Current conditions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 flex items-center justify-center">{w.icon}</div>
          <div>
            <div className="text-4xl font-bold text-white">{city.current.temperature.toFixed(0)}°C</div>
            <div className="text-sm text-slate-400">{w.label}</div>
            <div className="text-[11px] text-slate-500">Feels like {city.current.apparentTemp.toFixed(0)}°C</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <Droplets className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-slate-300">{city.current.humidity}%</span>
          </div>
          <div className="flex items-center gap-1.5 justify-end">
            <Wind className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-300">{city.current.windSpeed.toFixed(0)} km/h</span>
          </div>
          <div className="flex items-center gap-1.5 justify-end">
            <Gauge className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-slate-300">{city.current.windGusts.toFixed(0)} km/h</span>
          </div>
          <div className="flex items-center gap-1.5 justify-end">
            <Umbrella className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-slate-300">{city.current.precipitation.toFixed(1)} mm</span>
          </div>
        </div>
      </div>

      {/* Wind direction */}
      <div className="flex items-center gap-2 mb-4 text-xs text-slate-500">
        <span>Wind: {windDirToText(city.current.windDir)} ({city.current.windDir}°)</span>
        <span className="text-slate-700">|</span>
        <span>Gusts: {city.current.windGusts.toFixed(0)} km/h</span>
      </div>

      {/* 12-hour rain probability chart */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-2">
          <CloudRain className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-medium text-slate-400">Rain Probability — Next 12 Hours</span>
        </div>
        <div className="flex items-end gap-1 h-20">
          {next12Prob.map((prob, i) => {
            const isNow = i === 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-slate-700/40 rounded-t-sm relative" style={{ height: "60px" }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(prob / 100) * 60}px` }}
                    transition={{ delay: i * 0.03, duration: 0.4 }}
                    className={`absolute bottom-0 w-full rounded-t-sm ${prob >= 70 ? "bg-blue-500" : prob >= 40 ? "bg-blue-400/70" : "bg-slate-600/50"}`}
                  />
                </div>
                {i % 2 === 0 && (
                  <span className="text-[8px] text-slate-600">{next12Times[i]}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Alerts for this city */}
      {city.alerts.length > 0 && (
        <div className="space-y-2">
          {city.alerts.map((alert, i) => (
            <AlertCard key={i} alert={alert} />
          ))}
        </div>
      )}

      {/* 7-day forecast */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="flex items-center gap-1.5 mb-3">
          <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-medium text-slate-400">7-Day Forecast</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {city.daily.time.slice(0, 7).map((day, i) => {
            const dw = weatherInfo(city.daily.weatherCodeMax[i], true);
            const dayLabel = i === 0 ? "Today" : new Date(day).toLocaleString("en-PK", { weekday: "short" });
            return (
              <div key={i} className="text-center p-1.5 rounded-lg bg-slate-900/40">
                <div className="text-[10px] text-slate-500 mb-1">{dayLabel}</div>
                <div className="flex justify-center mb-1">{dw.icon}</div>
                <div className="text-[11px] text-white font-medium">{city.daily.tempMax[i].toFixed(0)}°</div>
                <div className="text-[10px] text-slate-500">{city.daily.tempMin[i].toFixed(0)}°</div>
                {city.daily.precipitationSum[i] > 0 && (
                  <div className="text-[9px] text-blue-400 mt-0.5">{city.daily.precipitationSum[i].toFixed(1)}mm</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function WeatherRadar() {
  const [weather, setWeather] = useState<CityWeather[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchWeather = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const results = await Promise.all(
        CITIES.map(async (city) => {
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day&hourly=precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset&timezone=Asia%2FKarachi&forecast_days=7`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to fetch weather for ${city.name}`);
          const data = await res.json();

          const hourly = {
            time: data.hourly.time,
            precipitationProb: data.hourly.precipitation_probability,
            precipitation: data.hourly.precipitation,
            windSpeed: data.hourly.wind_speed_10m,
            windGusts: data.hourly.wind_gusts_10m,
            weatherCode: data.hourly.weather_code,
          };
          const daily = {
            time: data.daily.time,
            weatherCodeMax: data.daily.weather_code,
            precipitationSum: data.daily.precipitation_sum,
            windSpeedMax: data.daily.wind_speed_10m_max,
            windGustsMax: data.daily.wind_gusts_10m_max,
            tempMax: data.daily.temperature_2m_max,
            tempMin: data.daily.temperature_2m_min,
            sunrise: data.daily.sunrise,
            sunset: data.daily.sunset,
          };

          return {
            name: city.name,
            lat: city.lat,
            lon: city.lon,
            current: {
              temperature: data.current.temperature_2m,
              apparentTemp: data.current.apparent_temperature,
              humidity: data.current.relative_humidity_2m,
              precipitation: data.current.precipitation,
              rain: data.current.rain,
              weatherCode: data.current.weather_code,
              windSpeed: data.current.wind_speed_10m,
              windDir: data.current.wind_direction_10m,
              windGusts: data.current.wind_gusts_10m,
              isDay: data.current.is_day === 1,
            },
            hourly,
            daily,
            alerts: generateAlerts({ hourly, daily }),
          } as CityWeather;
        })
      );
      setWeather(results);
      setLastUpdate(new Date());
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load weather data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
    // Auto-refresh every 10 minutes
    const interval = setInterval(fetchWeather, 600000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  const allAlerts = weather.flatMap((c) => c.alerts.map((a) => ({ ...a, city: c.name })));
  const highAlerts = allAlerts.filter((a) => a.severity === "high");

  if (loading && weather.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-cyan-400"
        />
        <p className="text-slate-400 text-sm">Fetching live weather radar…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-slate-400 text-sm">{error}</p>
        <button onClick={fetchWeather} className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg text-sm font-medium">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[1600px] mx-auto space-y-6"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Live Weather Radar</h2>
            <p className="text-slate-400 text-sm">
              Real-time conditions and alerts for Lahore, Sheikhupura & Kasur
              {lastUpdate && (
                <span className="ml-2 text-slate-600">· Updated {lastUpdate.toLocaleTimeString("en-PK")}</span>
              )}
            </p>
          </div>
          <button
            onClick={fetchWeather}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Operational Alert Banner */}
      {highAlerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-500/10 border border-red-500/40 rounded-xl p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">⚠️ Operational Alert — Action Required</h3>
              <p className="text-slate-400 text-xs">
                {highAlerts.length} high-severity weather alert(s) detected. Field teams should be on standby.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {highAlerts.map((alert, i) => (
              <div key={i} className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-red-400" />
                  <span className="text-red-400 font-semibold text-sm">{alert.city}</span>
                </div>
                <p className="text-xs text-slate-300">{alert.title}: {alert.message.split(".")[0]}.</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* City Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {weather.map((city, i) => (
          <motion.div
            key={city.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <CityCard city={city} />
          </motion.div>
        ))}
      </div>

      {/* Operational Guidance */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5 text-cyan-400" />
          Operational Team Guidance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700">
            <CloudRain className="w-5 h-5 text-blue-400 mb-2" />
            <h4 className="text-white font-medium text-sm mb-1">Rain Protocol</h4>
            <p className="text-xs text-slate-400">Check weatherproofing on outdoor cabinets, ensure cable trays are sealed, and monitor for water ingress in IBS sites.</p>
          </div>
          <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700">
            <Wind className="w-5 h-5 text-amber-400 mb-2" />
            <h4 className="text-white font-medium text-sm mb-1">Windstorm Protocol</h4>
            <p className="text-xs text-slate-400">Inspect antenna mounts, tower bolts, and dish alignment. Secure loose equipment on rooftops and ground sites.</p>
          </div>
          <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700">
            <CloudLightning className="w-5 h-5 text-purple-400 mb-2" />
            <h4 className="text-white font-medium text-sm mb-1">Lightning Protocol</h4>
            <p className="text-xs text-slate-400">Verify surge protection devices, grounding systems, and avoid tower climbing during active storms.</p>
          </div>
          <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700">
            <Thermometer className="w-5 h-5 text-red-400 mb-2" />
            <h4 className="text-white font-medium text-sm mb-1">Heat Protocol</h4>
            <p className="text-xs text-slate-400">Monitor DG fuel consumption, AC performance in shelters, and battery temperature for Li-ion banks.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
