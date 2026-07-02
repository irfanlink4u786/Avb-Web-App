import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Radio,
  MapPin,
  Fuel,
  Battery,
  Share2,
  Building2,
  Network,
  TrendingUp,
  Database,
  X,
  ChevronDown,
  ChevronUp,
  Activity,
  Users,
  Calendar,
  Loader2,
} from "lucide-react";
import { type SiteData, CATEGORY_COLORS, PGS_GROUP } from "../types";
import ExportButton from "./ExportButton";

// ============================================================
// Type declarations for Google Maps
// ============================================================
declare global {
  interface Window {
    google: any;
  }
}
declare const google: any; // for direct use, but we'll use window.google

// Google Maps API Key - Replace with your key
const GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY";

interface SiteQueryProps {
  sites: SiteData[];
}

// ============================================================
// SITE INFO CARD
// ============================================================

function SiteInfoCard({ site }: { site: SiteData }) {
  const [expanded, setExpanded] = useState(false);

  const mainFields = [
    { label: "Site ID", value: site.siteName, icon: <Radio className="w-3.5 h-3.5" /> },
    { label: "Revenue Category", value: site.revenueCategory, icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { label: "Group", value: PGS_GROUP.includes(site.revenueCategory) ? "PGS" : "SB" },
    { label: "Current CA", value: site.currentAvb > 0 ? `${site.currentAvb.toFixed(2)}%` : "—", icon: <Activity className="w-3.5 h-3.5" /> },
    { label: "Monthly AVB", value: site.monthlyAvb ? `${site.monthlyAvb.toFixed(2)}%` : "—" },
    { label: "Sub-Region", value: site.subRegion, icon: <MapPin className="w-3.5 h-3.5" /> },
    { label: "Grid", value: site.grid },
    { label: "Terrain", value: site.terrain, icon: <MapPin className="w-3.5 h-3.5" /> },
    { label: "Technology", value: site.technology, icon: <Network className="w-3.5 h-3.5" /> },
    { label: "Sharing Status", value: site.sharingStatus, icon: <Share2 className="w-3.5 h-3.5" /> },
    { label: "Indoor / Outdoor", value: site.indoorOutdoor, icon: <Building2 className="w-3.5 h-3.5" /> },
    { label: "DG Status", value: site.dgInstalled, icon: <Fuel className="w-3.5 h-3.5" /> },
    { label: "DG Rating", value: site.dgRating || "—" },
    { label: "Li-ion Installed", value: site.liIonInstalled, icon: <Battery className="w-3.5 h-3.5" /> },
    { label: "Li-ion Capacity", value: site.liIonCapacity ? `${site.liIonCapacity} Ah` : "—" },
  ];

  const expandedFields = [
    { label: "AGM/LION", value: site.agmBb || "—" },
    { label: "BB Status", value: site.bbStatus || "—" },
    { label: "Below Base", value: site.belowBase || "—" },
    { label: "HUB/Single", value: site.hubSingle || "—" },
    { label: "Dependent Sites", value: site.dependentSites || "—" },
    { label: "Cluster Owner", value: site.clusterOwner || "—", icon: <Users className="w-3.5 h-3.5" /> },
    { label: "MS GTL", value: site.msGtl || "—", icon: <Users className="w-3.5 h-3.5" /> },
    { label: "Zone Lead", value: site.zongLead || "—", icon: <Users className="w-3.5 h-3.5" /> },
    { label: "Chronic", value: site.chronic || "—" },
    { label: "DG Chronic", value: site.dgChronic || "—" },
    { label: "Li-ion Chronic", value: site.liIonChronic || "—" },
    { label: "Target", value: site.target ? `${site.target}%` : "—" },
    { label: "City", value: site.city || "—" },
    { label: "Latitude", value: (site as any).lat || "—" },
    { label: "Longitude", value: (site as any).lng || "—" },
  ];

  const isHealthy = site.currentAvb >= 95;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          <h3 className="text-white font-semibold text-sm">Site Information</h3>
          <span className={`text-[10px] px-2 py-0.5 rounded ${isHealthy ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
            {isHealthy ? "✓ Healthy" : "⚠ Critical"}
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Show Less" : "Show More"}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {mainFields.map((f) => (
          <div key={f.label} className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">
              {f.icon}
              {f.label}
            </div>
            <div className={`text-sm font-medium truncate ${
              f.label === "Current CA" && site.currentAvb > 0 
                ? site.currentAvb >= 95 ? "text-emerald-400" : "text-red-400"
                : "text-slate-100"
            }`}>
              {f.value || "—"}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-slate-700"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {expandedFields.map((f) => (
                <div key={f.label} className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">
                    {f.icon}
                    {f.label}
                  </div>
                  <div className="text-sm text-slate-100 font-medium truncate">
                    {f.value || "—"}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// AVB vs LS CHART (Combo Bar + Line - SVG based)
// ============================================================

function AvbLsChart({ site }: { site: SiteData }) {
  const avbData = site.dailyData || {};
  const lsData = site.dailyLs || {};

  const dates = useMemo(() => {
    const allDates = new Set([...Object.keys(avbData), ...Object.keys(lsData)]);
    return Array.from(allDates).sort((a, b) => {
      const numA = parseInt(a.split('-')[1]) || 0;
      const numB = parseInt(b.split('-')[1]) || 0;
      return numA - numB;
    });
  }, [avbData, lsData]);

  if (dates.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-2">Daily AVB vs Load Shedding Trend</h3>
        <div className="flex items-center justify-center h-64 text-slate-500">
          No daily data available for this site
        </div>
      </div>
    );
  }

  const maxAvb = 100;
  const maxLs = Math.max(...dates.map((d) => lsData[d] || 0), 1);

  const chartWidth = Math.max(dates.length * 36, 600);
  const chartHeight = 300;
  const padding = { top: 30, right: 50, bottom: 50, left: 50 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const barWidth = Math.max((innerWidth / dates.length) * 0.6, 4);
  const barGap = innerWidth / dates.length;

  const validAvb = dates.filter(d => avbData[d] !== undefined && avbData[d] > 0);
  const avgAvb = validAvb.length > 0
    ? validAvb.reduce((s, d) => s + avbData[d], 0) / validAvb.length
    : 0;
  const minAvb = validAvb.length > 0 ? Math.min(...validAvb.map(d => avbData[d])) : 0;
  const maxAvbVal = validAvb.length > 0 ? Math.max(...validAvb.map(d => avbData[d])) : 0;
  const daysBelow95 = dates.filter(d => (avbData[d] || 100) < 95).length;
  const lsAvg = Object.keys(lsData).length > 0
    ? Object.values(lsData).reduce((s, v) => s + v, 0) / Object.keys(lsData).length
    : 0;
  const lsAbove3 = Object.values(lsData).filter((v) => v > 3).length;

  const firstDate = dates.length > 0 ? dates[0] : '';
  const lastDate = dates.length > 0 ? dates[dates.length - 1] : '';

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-white font-semibold text-sm">Daily AVB vs Load Shedding Trend</h3>
          {firstDate && lastDate && (
            <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
              <Calendar className="w-3 h-3" />
              <span>Day {firstDate.split('-')[1]} to Day {lastDate.split('-')[1]}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }} />
            <span className="text-slate-400">AVB % (Bar)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-amber-400" />
            <span className="text-slate-400">Load Shedding hrs (Line)</span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg width={chartWidth} height={chartHeight} className="min-w-full">
          <defs>
            <linearGradient id="avbGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="avbGoodGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="avbWarningGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="avbDangerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#dc2626" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {[0, 25, 50, 75, 100].map((val) => {
            const y = padding.top + innerHeight - (val / maxAvb) * innerHeight;
            return (
              <g key={val}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text x={padding.left - 8} y={y + 4} fill="#06b6d4" fontSize="10" textAnchor="end">
                  {val}%
                </text>
              </g>
            );
          })}

          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + innerHeight - ratio * innerHeight;
            const lsVal = (ratio * maxLs).toFixed(1);
            return (
              <text
                key={ratio}
                x={chartWidth - padding.right + 8}
                y={y + 4}
                fill="#f59e0b"
                fontSize="10"
                textAnchor="start"
              >
                {lsVal}h
              </text>
            );
          })}

          {dates.map((date, i) => {
            const avb = avbData[date] || 0;
            const barH = (avb / maxAvb) * innerHeight;
            const x = padding.left + i * barGap + (barGap - barWidth) / 2;
            const y = padding.top + innerHeight - barH;
            
            let gradientId = 'avbGradient';
            if (avb >= 95) gradientId = 'avbGoodGradient';
            else if (avb >= 90) gradientId = 'avbWarningGradient';
            else if (avb > 0) gradientId = 'avbDangerGradient';
            
            return (
              <g key={`bar-${date}`}>
                <rect 
                  x={x} 
                  y={y} 
                  width={barWidth} 
                  height={barH} 
                  fill={`url(#${gradientId})`} 
                  rx="3" 
                  opacity="0.9"
                />
                {avb > 0 && (
                  <text 
                    x={x + barWidth / 2} 
                    y={y - 4} 
                    fill={avb < 95 ? "#ef4444" : "#94a3b8"} 
                    fontSize="8" 
                    textAnchor="middle" 
                    fontWeight="bold"
                  >
                    {avb.toFixed(1)}
                  </text>
                )}
              </g>
            );
          })}

          <polyline
            points={dates
              .map((date, i) => {
                const ls = lsData[date] || 0;
                const x = padding.left + i * barGap + barGap / 2;
                const y = padding.top + innerHeight - (ls / maxLs) * innerHeight;
                return `${x},${y}`;
              })
              .join(" ")}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeDasharray="4 2"
          />

          {dates.map((date, i) => {
            const ls = lsData[date] || 0;
            if (ls === 0) return null;
            const x = padding.left + i * barGap + barGap / 2;
            const y = padding.top + innerHeight - (ls / maxLs) * innerHeight;
            return (
              <circle 
                key={`ls-${date}`} 
                cx={x} 
                cy={y} 
                r="4" 
                fill="#f59e0b" 
                stroke="#0f172a" 
                strokeWidth="1.5"
              />
            );
          })}

          {dates.map((date, i) => {
            const x = padding.left + i * barGap + barGap / 2;
            const dayNum = date.split('-')[1] || '';
            if (dates.length > 20 && i % 2 !== 0) return null;
            if (dates.length > 40 && i % 3 !== 0) return null;
            return (
              <text
                key={`x-${date}`}
                x={x}
                y={chartHeight - padding.bottom + 16}
                fill="#64748b"
                fontSize="8"
                textAnchor="middle"
                transform={`rotate(-45, ${x}, ${chartHeight - padding.bottom + 16})`}
              >
                Day {dayNum}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-4">
        <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Avg AVB</p>
          <p className={`text-sm font-bold ${avgAvb >= 95 ? "text-emerald-400" : "text-red-400"}`}>
            {avgAvb.toFixed(2)}%
          </p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Min AVB</p>
          <p className="text-sm font-bold text-red-400">{minAvb.toFixed(2)}%</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Max AVB</p>
          <p className="text-sm font-bold text-emerald-400">{maxAvbVal.toFixed(2)}%</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Avg LS</p>
          <p className="text-sm font-bold text-amber-400">{lsAvg.toFixed(2)}h</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Days Below 95%</p>
          <p className="text-sm font-bold text-red-400">{daysBelow95}</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">LS &gt; 3hr</p>
          <p className="text-sm font-bold text-orange-400">{lsAbove3}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// GOOGLE MAPS COMPONENT
// ============================================================

// Load Google Maps script
const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.getElementById('google-maps-script')) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });
};

function GoogleMap({ 
  sites, 
  selectedSite, 
  onSelect,
  mapSearch,
}: { 
  sites: SiteData[]; 
  selectedSite: string | null;
  onSelect: (site: SiteData) => void;
  mapSearch: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filter sites with valid location
  const sitesWithLocation = useMemo(() => {
    return sites.filter(site => {
      const lat = parseFloat((site as any).lat || '');
      const lng = parseFloat((site as any).lng || '');
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });
  }, [sites]);

  // Filter sites based on map search
  const filteredSites = useMemo(() => {
    if (!mapSearch.trim()) return sitesWithLocation;
    const q = mapSearch.toLowerCase();
    return sitesWithLocation.filter(site =>
      site.siteName?.toLowerCase().includes(q) ||
      site.revenueCategory?.toLowerCase().includes(q) ||
      site.subRegion?.toLowerCase().includes(q) ||
      site.grid?.toLowerCase().includes(q) ||
      site.clusterOwner?.toLowerCase().includes(q)
    );
  }, [sitesWithLocation, mapSearch]);

  // Find selected site
  const selectedSiteData = useMemo(() => {
    if (!selectedSite) return null;
    return sitesWithLocation.find(s => s.siteName === selectedSite) || null;
  }, [selectedSite, sitesWithLocation]);

  // Initialize map
  useEffect(() => {
    const initMap = async () => {
      try {
        await loadGoogleMapsScript(GOOGLE_MAPS_API_KEY);
        
        if (!mapRef.current || !window.google) return;

        // Default center (Pakistan)
        const defaultCenter = { lat: 30.3753, lng: 69.3451 };
        
        // Center on selected site if available
        let center = defaultCenter;
        if (selectedSiteData) {
          const lat = parseFloat((selectedSiteData as any).lat || '');
          const lng = parseFloat((selectedSiteData as any).lng || '');
          if (!isNaN(lat) && !isNaN(lng)) {
            center = { lat, lng };
          }
        }

        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          center,
          zoom: selectedSiteData ? 12 : 6,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            {
              featureType: "administrative.locality",
              elementType: "labels.text.fill",
              stylers: [{ color: "#d59563" }],
            },
            {
              featureType: "poi",
              elementType: "labels.text.fill",
              stylers: [{ color: "#d59563" }],
            },
            {
              featureType: "poi.park",
              elementType: "geometry",
              stylers: [{ color: "#263c3f" }],
            },
            {
              featureType: "poi.park",
              elementType: "labels.text.fill",
              stylers: [{ color: "#6b9a76" }],
            },
            {
              featureType: "road",
              elementType: "geometry",
              stylers: [{ color: "#38414e" }],
            },
            {
              featureType: "road",
              elementType: "geometry.stroke",
              stylers: [{ color: "#212a37" }],
            },
            {
              featureType: "road",
              elementType: "labels.text.fill",
              stylers: [{ color: "#9ca5b3" }],
            },
            {
              featureType: "road.highway",
              elementType: "geometry",
              stylers: [{ color: "#746855" }],
            },
            {
              featureType: "road.highway",
              elementType: "geometry.stroke",
              stylers: [{ color: "#1f2835" }],
            },
            {
              featureType: "road.highway",
              elementType: "labels.text.fill",
              stylers: [{ color: "#f3d19c" }],
            },
            {
              featureType: "transit",
              elementType: "geometry",
              stylers: [{ color: "#2f3948" }],
            },
            {
              featureType: "transit.station",
              elementType: "labels.text.fill",
              stylers: [{ color: "#d59563" }],
            },
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [{ color: "#17263c" }],
            },
            {
              featureType: "water",
              elementType: "labels.text.fill",
              stylers: [{ color: "#515c6d" }],
            },
            {
              featureType: "water",
              elementType: "labels.text.stroke",
              stylers: [{ color: "#17263c" }],
            },
          ],
        });

        infoWindowRef.current = new window.google.maps.InfoWindow();
        setMapLoaded(true);
        setLoading(false);
      } catch (error) {
        console.error('Error loading Google Maps:', error);
        setLoading(false);
      }
    };

    initMap();
  }, []);

  // Update markers when filtered sites change
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Create new markers
    filteredSites.forEach(site => {
      const lat = parseFloat((site as any).lat || '');
      const lng = parseFloat((site as any).lng || '');
      if (isNaN(lat) || isNaN(lng)) return;

      const isHealthy = site.currentAvb >= 98;
      const isSelected = selectedSite === site.siteName;

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map: mapInstanceRef.current,
        title: site.siteName,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: isHealthy ? '#10b981' : '#ef4444',
          fillOpacity: isSelected ? 1 : 0.8,
          strokeColor: isSelected ? '#06b6d4' : '#ffffff',
          strokeWeight: isSelected ? 3 : 1,
          scale: isSelected ? 10 : 8,
        },
        animation: isSelected ? window.google.maps.Animation.BOUNCE : undefined,
        zIndex: isSelected ? 100 : 1,
      });

      // Add click listener
      marker.addListener('click', () => {
        onSelect(site);
        if (infoWindowRef.current) {
          const content = `
            <div style="padding: 8px; max-width: 200px; background: #1e293b; color: #f1f5f9; border-radius: 8px; border: 1px solid #334155;">
              <div style="font-weight: bold; color: #06b6d4; font-size: 14px;">${site.siteName}</div>
              <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">
                <div>Category: ${site.revenueCategory}</div>
                <div>Region: ${site.subRegion}</div>
                <div style="color: ${isHealthy ? '#10b981' : '#ef4444'}; font-weight: bold;">
                  CA: ${site.currentAvb.toFixed(2)}%
                </div>
                <div>Grid: ${site.grid}</div>
                <div>Cluster Owner: ${site.clusterOwner || '-'}</div>
              </div>
            </div>
          `;
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open(mapInstanceRef.current, marker);
        }
      });

      markersRef.current.push(marker);
    });

    // Fit bounds to show all markers
    if (filteredSites.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      filteredSites.forEach(site => {
        const lat = parseFloat((site as any).lat || '');
        const lng = parseFloat((site as any).lng || '');
        if (!isNaN(lat) && !isNaN(lng)) {
          bounds.extend({ lat, lng });
        }
      });
      mapInstanceRef.current.fitBounds(bounds);
      
      // If only one site, zoom in more
      if (filteredSites.length === 1) {
        const zoom = mapInstanceRef.current.getZoom();
        if (zoom) {
          mapInstanceRef.current.setZoom(Math.min(zoom + 2, 18));
        }
      }
    }

  }, [filteredSites, selectedSite, mapLoaded, onSelect]);

  // Center on selected site when it changes
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedSiteData || !mapLoaded) return;

    const lat = parseFloat((selectedSiteData as any).lat || '');
    const lng = parseFloat((selectedSiteData as any).lng || '');
    if (!isNaN(lat) && !isNaN(lng)) {
      mapInstanceRef.current.panTo({ lat, lng });
      mapInstanceRef.current.setZoom(14);
    }
  }, [selectedSiteData, mapLoaded]);

  if (sitesWithLocation.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
        <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">No location data available for sites</p>
        <p className="text-slate-500 text-xs mt-1">Lat/Long not found in data (Columns Lat & Long)</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
        <Loader2 className="w-12 h-12 text-cyan-400 mx-auto mb-3 animate-spin" />
        <p className="text-slate-400">Loading Google Maps...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <MapPin className="w-4 h-4 text-cyan-400" />
          <h4 className="text-sm font-semibold text-white">
            Site Locations ({filteredSites.length} / {sitesWithLocation.length} sites)
          </h4>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-slate-400">Healthy (≥98%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-slate-400">Critical (&lt;98%)</span>
          </span>
        </div>
      </div>
      <div 
        ref={mapRef} 
        className="w-full h-[500px] bg-slate-900"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function SiteQuery({ sites }: SiteQueryProps) {
  const [search, setSearch] = useState("");
  const [mapSearch, setMapSearch] = useState("");
  const [selectedSite, setSelectedSite] = useState<SiteData | null>(null);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return sites
      .filter((s) =>
        s.siteName?.toLowerCase().includes(q) ||
        s.grid?.toLowerCase().includes(q) ||
        s.subRegion?.toLowerCase().includes(q) ||
        s.clusterOwner?.toLowerCase().includes(q) ||
        s.revenueCategory?.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [search, sites]);

  const handleSelect = (site: SiteData) => {
    setSelectedSite(site);
    setSearch(site.siteName);
    setMapSearch(site.siteName);
  };

  const clearSearch = () => {
    setSearch("");
    setSelectedSite(null);
    setMapSearch("");
  };

  const dailyExport = useMemo(() => {
    if (!selectedSite) return [];
    const avb = selectedSite.dailyData || {};
    const ls = selectedSite.dailyLs || {};
    const dates = Array.from(new Set([...Object.keys(avb), ...Object.keys(ls)])).sort((a, b) => {
      const numA = parseInt(a.split('-')[1]) || 0;
      const numB = parseInt(b.split('-')[1]) || 0;
      return numA - numB;
    });
    return dates.map((d) => ({
      Date: d,
      "AVB %": avb[d] !== undefined ? avb[d].toFixed(2) : "",
      "Load Shedding (hrs)": ls[d] !== undefined ? ls[d].toFixed(2) : "",
    }));
  }, [selectedSite]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[1600px] mx-auto space-y-6"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <Search className="w-6 h-6 text-cyan-400" />
          <div>
            <h3 className="text-white font-bold text-lg">Site Query</h3>
            <p className="text-slate-300 text-sm">
              Search for a site to view detailed information, daily AVB vs Load Shedding trend, and location
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedSite(null);
              setMapSearch(e.target.value);
            }}
            placeholder="Search by Site ID, Grid, Sub-Region, Cluster Owner, or Category…"
            className="w-full pl-9 pr-10 py-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-cyan-500 outline-none text-sm text-slate-100 placeholder:text-slate-600"
          />
          {search && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results */}
        <AnimatePresence>
          {search.trim() && !selectedSite && searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-2 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden max-h-72 overflow-y-auto"
            >
              {searchResults.map((site) => (
                <button
                  key={site.siteName}
                  onClick={() => handleSelect(site)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800 border-b border-slate-700/50 text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Radio className="w-4 h-4 text-cyan-400" />
                    <div>
                      <span className="text-slate-100 font-mono text-sm">{site.siteName}</span>
                      <span className="text-slate-500 text-xs ml-2">
                        {site.revenueCategory} · {site.subRegion} · {site.grid}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs px-2 py-0.5 rounded font-medium"
                      style={{
                        background: `${CATEGORY_COLORS[site.revenueCategory] || "#475569"}22`,
                        color: CATEGORY_COLORS[site.revenueCategory] || "#94a3b8",
                      }}
                    >
                      {site.revenueCategory}
                    </span>
                    <span className={`text-sm font-bold ${site.currentAvb >= 95 ? "text-emerald-400" : "text-red-400"}`}>
                      {site.currentAvb > 0 ? `${site.currentAvb.toFixed(1)}%` : "—"}
                    </span>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Google Map - Always visible */}
      <GoogleMap
        sites={sites}
        selectedSite={selectedSite?.siteName || null}
        onSelect={handleSelect}
        mapSearch={mapSearch}
      />

      {/* Selected Site Detail */}
      {selectedSite && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Site Info */}
          <SiteInfoCard site={selectedSite} />

          {/* Chart */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-white font-bold text-lg">
              {selectedSite.siteName} — Daily Trend
            </h3>
            {dailyExport.length > 0 && (
              <ExportButton
                data={dailyExport}
                filename={`site_${selectedSite.siteName}_daily`}
                sheetName="Daily Data"
                label="Export Daily Data"
              />
            )}
          </div>
          <AvbLsChart site={selectedSite} />
        </motion.div>
      )}

      {/* No Selection State */}
      {!selectedSite && !search.trim() && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
          <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">
            Start typing a Site ID, Grid, Sub-Region, or Cluster Owner to search
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-400">Site ID</span>
            <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-400">Grid</span>
            <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-400">Sub-Region</span>
            <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-400">Cluster Owner</span>
            <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-400">Category</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}