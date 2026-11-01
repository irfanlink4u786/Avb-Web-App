import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { SiteData } from "./types";
import { ExportButtonComponent } from "./SharedDashboardUI";

// Current-month CA bands; missing/zero CA is excluded from these bands.
export type CaBand = "all" | "below95" | "95to98" | "above98";
export const matchesCaBand = (value: number, band: CaBand) => {
  if (band === "all") return true;
  if (!Number.isFinite(value) || value <= 0) return false;
  if (band === "below95") return value < 95;
  if (band === "95to98") return value >= 95 && value < 98;
  return value >= 98;
};
export const caBandOptions: { value: CaBand; label: string }[] = [
  { value: "all", label: "All CA" },
  { value: "below95", label: "Below 95%" },
  { value: "95to98", label: "95% to <98%" },
  { value: "above98", label: "98% & Above" },
];

// ============================================================
//  EMPLOYEE PERFORMANCE — INLINE / SELF-CONTAINED
//  Expanded All Sites includes latest 3 actual populated Cell AVB days.
// ============================================================

type EmployeePerformanceProps = {
  sites: SiteData[];
  lastUpdatedDate?: string;
};

type EmployeePerformanceLevel = "zongLead" | "msGtl" | "clusterOwner";

const EMP_MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const MONTH_LABELS: Record<string, string> = {
  Jan: "Jan",
  Feb: "Feb",
  Mar: "Mar",
  Apr: "Apr",
  May: "May",
  Jun: "Jun",
  Jul: "Jul",
  Aug: "Aug",
  Sep: "Sep",
  Oct: "Oct",
  Nov: "Nov",
  Dec: "Dec",
};

/**
 * Normalize supported sheet date headers such as:
 * 18-Sep-26
 * 18 Sep 26
 * 18/SEP/2026
 *
 * Returns D-Mmm-YY, e.g. 18-Sep-26.
 */
export function empNormalizeDailyDateKey(raw: string): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  const match = text.match(
    /^(\d{1,2})[-\s/]([A-Za-z]{3,9})[-\s/](\d{2,4})$/
  );
  if (!match) return null;

  const day = Number(match[1]);
  const rawMonth = match[2].slice(0, 3);
  const month =
    rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1).toLowerCase();

  if (
    !Number.isFinite(day) ||
    day < 1 ||
    day > 31 ||
    EMP_MONTHS[month] === undefined
  ) {
    return null;
  }

  const year =
    match[3].length === 4 ? match[3].slice(-2) : match[3].padStart(2, "0");

  return `${day}-${month}-${year}`;
}

export function empDateKeyToTime(key: string): number {
  const normalized = empNormalizeDailyDateKey(key);
  if (!normalized) return Number.NaN;

  const [dayText, month, yearText] = normalized.split("-");
  return new Date(
    2000 + Number(yearText),
    EMP_MONTHS[month],
    Number(dayText)
  ).getTime();
}

export function empFormatDailyDateHeader(key: string): string {
  const normalized = empNormalizeDailyDateKey(key);
  if (!normalized) return key;

  const [day, month] = normalized.split("-");
  return `${day}-${MONTH_LABELS[month] ?? month}`;
}

/**
 * dailyData may contain the same logical date in a slightly different format
 * than the normalized key. This helper makes the lookup robust.
 */
export function empGetDailyAvb(site: SiteData, normalizedDate: string): number {
  const dailyData = site.dailyData ?? {};

  if (
    Object.prototype.hasOwnProperty.call(dailyData, normalizedDate) &&
    Number.isFinite(Number(dailyData[normalizedDate]))
  ) {
    return Number(dailyData[normalizedDate]);
  }

  for (const [rawKey, rawValue] of Object.entries(dailyData)) {
    const normalized = empNormalizeDailyDateKey(rawKey);
    const value = Number(rawValue);

    if (
      normalized === normalizedDate &&
      Number.isFinite(value)
    ) {
      return value;
    }
  }

  return 0;
}

export function empCaTextClass(value: number): string {
  if (value <= 0) return "text-slate-400";
  if (value < 98) return "text-red-600";
  if (value < 99) return "text-amber-700";
  return "text-emerald-700";
}

// Shared enterprise-style availability badge; visual-only, no KPI logic changes.
export function AvailabilityBadge({ value, digits = 2 }: { value: number; digits?: number }) {
  const valid = Number.isFinite(value) && value > 0;
  const tone = !valid
    ? "bg-slate-100 text-slate-500 ring-slate-200"
    : value < 98
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : value < 99
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-emerald-50 text-emerald-800 ring-emerald-200";
  return <span className={`inline-flex min-w-[74px] justify-center rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ring-1 ring-inset ${tone}`}>{valid ? `${value.toFixed(digits)}%` : "–"}</span>;
}

export function EmployeePerformance({
  sites,
  lastUpdatedDate = "",
}: EmployeePerformanceProps) {
  const [level, setLevel] = useState<EmployeePerformanceLevel>("zongLead");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [caBand, setCaBand] = useState<CaBand>("all");

  const activeSites = useMemo(
    () => sites.filter((site) => Number(site.currentAvb) > 0 && matchesCaBand(Number(site.currentAvb), caBand)),
    [sites, caBand]
  );

  /**
   * Latest 3 ACTUAL populated Cell AVB dates.
   *
   * Rules:
   * 1. Date must exist in dailyData.
   * 2. At least one site must contain a valid >0 value for that date.
   * 3. Date cannot be later than lastUpdatedDate.
   * 4. When lastUpdatedDate is supplied, only the same month/year is used.
   * 5. Return the latest three dates in chronological order.
   */
  const latest3Dates = useMemo(() => {
    const availableDates = new Set<string>();
    const cutoff = empNormalizeDailyDateKey(lastUpdatedDate);

    const cutoffParts = cutoff?.split("-") ?? [];
    const cutoffMonth = cutoffParts[1] ?? "";
    const cutoffYear = cutoffParts[2] ?? "";
    const cutoffTime = cutoff ? empDateKeyToTime(cutoff) : Number.POSITIVE_INFINITY;

    activeSites.forEach((site) => {
      Object.entries(site.dailyData ?? {}).forEach(([rawKey, rawValue]) => {
        const normalized = empNormalizeDailyDateKey(rawKey);
        const value = Number(rawValue);

        if (!normalized) return;
        if (!Number.isFinite(value) || value <= 0) return;

        const currentTime = empDateKeyToTime(normalized);
        if (!Number.isFinite(currentTime)) return;
        if (currentTime > cutoffTime) return;

        if (cutoff) {
          const [, month, year] = normalized.split("-");
          if (month !== cutoffMonth || year !== cutoffYear) return;
        }

        availableDates.add(normalized);
      });
    });

    return Array.from(availableDates)
      .sort((a, b) => empDateKeyToTime(a) - empDateKeyToTime(b))
      .slice(-3);
  }, [activeSites, lastUpdatedDate]);

  const employeeRows = useMemo(() => {
    const employeeMap = new Map<string, SiteData[]>();

    activeSites.forEach((site) => {
      const employee =
        String(site[level] ?? "Unassigned").trim() || "Unassigned";

      if (!employeeMap.has(employee)) {
        employeeMap.set(employee, []);
      }

      employeeMap.get(employee)!.push(site);
    });

    return Array.from(employeeMap.entries())
      .map(([name, employeeSites]) => {
        const avg =
          employeeSites.length > 0
            ? employeeSites.reduce(
                (sum, site) => sum + Number(site.currentAvb || 0),
                0
              ) / employeeSites.length
            : 0;

        return {
          name,
          sites: employeeSites,
          avg,
        };
      })
      .sort((a, b) => a.avg - b.avg);
  }, [activeSites, level]);

  const employeeSummaryExport = useMemo(() => employeeRows.map(row => ({
    Employee: row.name, "Total Sites": row.sites.length,
    "Current CA (%)": Number(row.avg.toFixed(2)), "Employee Level": level,
  })), [employeeRows, level]);
  const employeeSiteExport = (employeeSites: SiteData[], employeeName: string) =>
    employeeSites.map(site => {
      const result: Record<string, string | number> = {
        Employee: employeeName, "Site ID": site.siteName,
        "Revenue Category": site.revenueCategory || "-",
        "Current Month CA (%)": Number(site.currentAvb || 0),
        "Sub-Region": site.subRegion || "-", Grid: site.grid || "-",
        DG: site.dgStatus || site.dgInstalled || "-",
        "Li-ion": site.liIonInstalled || "-", "BB Status": site.bbStatus || "-",
      };
      latest3Dates.forEach(date => {
        result[`${empFormatDailyDateHeader(date)} Cell AVB (%)`] = empGetDailyAvb(site, date);
      });
      return result;
    });

  const allEmployeesSitesExport = useMemo(() => employeeRows.flatMap(row => employeeSiteExport(row.sites, row.name)), [employeeRows, latest3Dates]);

  const levelButtons: { id: EmployeePerformanceLevel; label: string }[] = [
    { id: "zongLead", label: "CMPAK GTL" },
    { id: "msGtl", label: "MPL GTL" },
    { id: "clusterOwner", label: "Cluster Owner" },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
        <div>
          <h3 className="text-lg font-extrabold text-slate-950">
            Employee Performance
          </h3>
          <p className="mt-1 text-xs font-medium text-slate-600">
            Open an employee to view all sites with latest 3 days Cell AVB.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportButtonComponent data={employeeSummaryExport} filename={`employees_${level}_summary`} label="Export Summary" format="excel" variant="primary" />
          <ExportButtonComponent data={allEmployeesSitesExport} filename={`employees_${level}_all_sites`} label="Export All Sites" format="excel" variant="success" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="employee-ca-band" className="text-xs font-bold text-slate-700">Current CA</label>
          <select id="employee-ca-band" value={caBand} onChange={e => { setCaBand(e.target.value as CaBand); setExpanded(null); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900">
            {caBandOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {levelButtons.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setLevel(item.id);
                setExpanded(null);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-extrabold transition-colors ${
                level === item.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-800 hover:bg-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Employee summary */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th className="px-4 py-3 text-left font-extrabold uppercase tracking-wide text-white">
                Employee
              </th>
              <th className="px-4 py-3 text-center font-extrabold uppercase tracking-wide text-white">
                Sites
              </th>
              <th className="px-4 py-3 text-center font-extrabold uppercase tracking-wide text-white">
                Current CA
              </th>
              <th className="px-4 py-3 text-center font-extrabold uppercase tracking-wide text-white">
                View Sites
              </th>
            </tr>
          </thead>

          <tbody>
            {employeeRows.map((row) => {
              const isExpanded = expanded === row.name;

              return (
                <React.Fragment key={row.name}>
                  <tr className="border-t border-slate-100 even:bg-slate-50/60 transition-colors duration-200 hover:bg-emerald-50/50">
                    <td className="px-4 py-3 font-bold text-slate-950">
                      {row.name}
                    </td>

                    <td className="px-4 py-3 text-center font-extrabold text-slate-950">
                      {row.sites.length}
                    </td>

                    <td
                      className={`px-4 py-3 text-center text-base font-black ${empCaTextClass(
                        row.avg
                      )}`}
                    >
                      <AvailabilityBadge value={row.avg} />
                    </td>

                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded(isExpanded ? null : row.name)
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-extrabold text-emerald-800 transition-all duration-200 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        View
                        {isExpanded ? (
                          <ChevronUp size={15} />
                        ) : (
                          <ChevronDown size={15} />
                        )}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded All Sites */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={4} className="bg-slate-50 p-4">
                        <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
                          <div className="border-b border-slate-200 bg-white px-4 py-3">
                            <h4 className="text-sm font-black text-black">
                              All Sites ({row.sites.length})
                            </h4>

                            <div className="mt-2">
                              <ExportButtonComponent data={employeeSiteExport(row.sites, row.name)} filename={`employee_${row.name.replace(/[^a-z0-9]+/gi, "_")}_sites`} label="Export Employee Sites" format="excel" variant="success" />
                            </div>
                            <p className="mt-1 text-xs font-semibold text-slate-700">
                              Latest 3 days Cell AVB:
                              {latest3Dates.length > 0 ? (
                                <span className="ml-1 font-extrabold text-black">
                                  {latest3Dates
                                    .map(empFormatDailyDateHeader)
                                    .join(" | ")}
                                </span>
                              ) : (
                                <span className="ml-1 text-red-600">
                                  No populated daily AVB dates found
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="min-w-[1350px] w-full text-sm">
                              <thead
                                className="employee-all-sites-header bg-emerald-900 text-white"
                              >
                                <tr className="border-b border-sky-200">
                                  <th className="px-3 py-3 text-left text-[12px] font-black !text-white whitespace-nowrap">
                                    Site ID
                                  </th>
                                  <th className="px-3 py-3 text-left text-[12px] font-black !text-white whitespace-nowrap">
                                    Revenue Category
                                  </th>
                                  <th className="px-3 py-3 text-center text-[12px] font-black !text-white whitespace-nowrap">
                                    Current Month
                                  </th>
                                  <th className="px-3 py-3 text-center text-[12px] font-black !text-white whitespace-nowrap">
                                    Sub-Region
                                  </th>
                                  <th className="px-3 py-3 text-center text-[12px] font-black !text-white whitespace-nowrap">
                                    DG
                                  </th>
                                  <th className="px-3 py-3 text-center text-[12px] font-black !text-white whitespace-nowrap">
                                    Li-ion
                                  </th>
                                  <th className="px-3 py-3 text-center text-[12px] font-black !text-white whitespace-nowrap">
                                    BB Status
                                  </th>

                                  {latest3Dates.map((date) => (
                                    <th
                                      key={date}
                                      className="min-w-[120px] px-3 py-3 text-center text-[12px] font-black !text-white whitespace-nowrap"
                                    >
                                      <div>
                                        {empFormatDailyDateHeader(date)}
                                      </div>
                                      <div className="mt-0.5 text-[10px] font-black uppercase tracking-wide !text-white">
                                        Cell AVB
                                      </div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>

                              <tbody>
                                {[...row.sites]
                                  .sort(
                                    (a, b) =>
                                      Number(a.currentAvb || 0) -
                                      Number(b.currentAvb || 0)
                                  )
                                  .map((site) => (
                                    <tr
                                      key={site.siteName}
                                      className="border-t border-slate-100 even:bg-slate-50/60 transition-colors duration-200 hover:bg-emerald-50/60"
                                    >
                                      <td className="px-3 py-3 font-extrabold text-blue-700 whitespace-nowrap">
                                        {site.siteName}
                                      </td>

                                      <td className="px-3 py-3 font-bold text-slate-950 whitespace-nowrap">
                                        {site.revenueCategory || "-"}
                                      </td>

                                      <td
                                        className={`px-3 py-3 text-center text-[15px] font-black whitespace-nowrap ${empCaTextClass(
                                          Number(site.currentAvb || 0)
                                        )}`}
                                      >
                                        <AvailabilityBadge value={Number(site.currentAvb || 0)} />
                                      </td>

                                      <td className="px-3 py-3 text-center font-bold text-slate-950 whitespace-nowrap">
                                        {site.subRegion || "-"}
                                      </td>

                                      <td className="px-3 py-3 text-center font-semibold text-slate-900 whitespace-nowrap">
                                        {site.dgStatus ||
                                          site.dgInstalled ||
                                          "-"}
                                      </td>

                                      <td className="px-3 py-3 text-center font-semibold text-slate-900 whitespace-nowrap">
                                        {site.liIonInstalled || "-"}
                                      </td>

                                      <td className="px-3 py-3 text-center font-semibold text-slate-900 whitespace-nowrap">
                                        {site.bbStatus || "-"}
                                      </td>

                                      {latest3Dates.map((date) => {
                                        const value = empGetDailyAvb(site, date);

                                        return (
                                          <td
                                            key={`${site.siteName}-${date}`}
                                            className={`px-3 py-3 text-center text-[15px] font-black whitespace-nowrap ${empCaTextClass(
                                              value
                                            )}`}
                                          >
                                            <AvailabilityBadge value={value} />
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {employeeRows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-12 text-center font-semibold text-slate-500"
                >
                  No employee/site data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

