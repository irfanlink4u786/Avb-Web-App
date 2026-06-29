import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CloudRain, X, MapPin } from "lucide-react";

interface RainInfo {
  city: string;
  maxProb: number;
  rainHours: number;
  startTime: string | null;
}

/**
 * Blinking flip-in/flip-out rain alert widget.
 * Fetches live weather from Open-Meteo for Lahore, Sheikhupura, Kasur.
 * If any city has >=60% rain probability in the next 12 hours,
 * the widget blinks in (flip-in) and blinks out (flip-out) on a loop.
 */
export default function RainAlertWidget() {
  const [rainCities, setRainCities] = useState<RainInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const CITIES = [
    { name: "Lahore", lat: 31.5204, lon: 74.3587 },
    { name: "Sheikhupura", lat: 31.7131, lon: 73.9783 },
    { name: "Kasur", lat: 31.1156, lon: 74.4489 },
  ];

  useEffect(() => {
    let cancelled = false;

    async function checkRain() {
      try {
        const results = await Promise.all(
          CITIES.map(async (city) => {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&hourly=precipitation_probability,weather_code&timezone=Asia%2FKarachi&forecast_days=2`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Weather fetch failed for ${city.name}`);
            const data = await res.json();

            const now = new Date();
            const nowIdx = data.hourly.time.findIndex(
              (t: string) => new Date(t) >= now
            );
            const startIdx = Math.max(0, nowIdx);

            // Next 12 hours
            const next12Prob = data.hourly.precipitation_probability.slice(
              startIdx,
              startIdx + 12
            );
            const next12Times = data.hourly.time.slice(startIdx, startIdx + 12);
            const next12Codes = data.hourly.weather_code.slice(
              startIdx,
              startIdx + 12
            );

            const maxProb = Math.max(...next12Prob, 0);
            const rainHours = next12Prob.filter(
              (p: number, i: number) => p >= 60 || next12Codes[i] >= 51
            ).length;

            // Find first rain time
            let startTime: string | null = null;
            for (let i = 0; i < next12Prob.length; i++) {
              if (next12Prob[i] >= 40 || next12Codes[i] >= 51) {
                startTime = new Date(next12Times[i]).toLocaleString("en-PK", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "numeric",
                  month: "short",
                });
                break;
              }
            }

            return {
              city: city.name,
              maxProb,
              rainHours,
              startTime,
            } as RainInfo;
          })
        );

        if (!cancelled) {
          // Only show cities with rain probability >= 40%
          setRainCities(results.filter((r) => r.maxProb >= 60));
          setLoading(false);
        }
      } catch (err) {
        console.error("Rain check failed:", err);
        if (!cancelled) setLoading(false);
      }
    }

    checkRain();
    // Refresh every 15 minutes
    const interval = setInterval(checkRain, 900000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Don't render if loading, dismissed, or no rain
  if (loading || dismissed || rainCities.length === 0) return null;

  const hasHighRisk = rainCities.some((r) => r.maxProb >= 70);
  const maxProb = Math.max(...rainCities.map((r) => r.maxProb));

  return (
    <div className="fixed top-20 right-4 z-50 sm:right-6">
      <AnimatePresence mode="wait">
        <motion.div
          key="rain-alert"
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{
            rotateX: [0, 0, -90, 0, 0],
            opacity: [1, 1, 0, 1, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 0.5,
            times: [0, 0.4, 0.5, 0.6, 1],
          }}
          className={`origin-top ${
            hasHighRisk
              ? "bg-gradient-to-r from-red-600 to-orange-600"
              : "bg-gradient-to-r from-blue-600 to-cyan-600"
          } rounded-xl shadow-2xl border-2 ${
            hasHighRisk ? "border-red-400" : "border-blue-400"
          } p-4 max-w-xs`}
          style={{ transformStyle: "preserve-3d" }}
        >
          <div className="flex items-start gap-3">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="shrink-0 mt-0.5"
            >
              <CloudRain className="w-6 h-6 text-white" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-white font-bold text-sm">
                  {hasHighRisk ? "🌧️ Heavy Rain Alert" : "☔ Rain Expected"}
                </span>
              </div>
              <p className="text-white/90 text-xs leading-relaxed mb-2">
                Rain expected in next 12 hours. Prepare outdoor sites for
                potential power outages & water ingress.
              </p>
              <div className="space-y-1">
                {rainCities.map((r) => (
                  <div
                    key={r.city}
                    className="flex items-center justify-between bg-black/20 rounded px-2 py-1"
                  >
                    <span className="flex items-center gap-1 text-white/90 text-[11px]">
                      <MapPin className="w-3 h-3" />
                      {r.city}
                    </span>
                    <span className="text-white font-semibold text-[11px]">
                      {r.maxProb}% · {r.rainHours}h
                    </span>
                  </div>
                ))}
              </div>
              {rainCities[0]?.startTime && (
                <p className="text-white/70 text-[10px] mt-1.5">
                  Starts: {rainCities[0].startTime}
                </p>
              )}
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-white/60 hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
