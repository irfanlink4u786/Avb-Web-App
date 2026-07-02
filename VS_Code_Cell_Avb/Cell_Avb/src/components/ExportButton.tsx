import { useState, useEffect, useRef } from "react";
import { Download, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";
import * as XLSX from "xlsx";

function formatDateForFilename(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function doExport(
  data: Record<string, unknown>[],
  filename: string,
  format: "excel" | "csv",
  sheetName = "Sheet1"
): void {
  if (!data || data.length === 0) return;

  if (format === "csv") {
    // CSV export — simple and reliable, no library needed
    const headers = Object.keys(data[0]);
    const escape = (val: unknown) => {
      const s = val == null ? "" : String(val);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const csv = [
      headers.join(","),
      ...data.map((row) => headers.map((h) => escape(row[h])).join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    // Excel export using xlsx
    const worksheet = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, worksheet, sheetName.slice(0, 31));
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }
}

export default function ExportButton({
  data,
  filename,
  sheetName,
  label = "Export",
  variant = "default",
}: {
  data: Record<string, unknown>[];
  filename: string;
  sheetName?: string;
  label?: string;
  variant?: "default" | "compact" | "icon";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = (format: "excel" | "csv") => {
    try {
      doExport(data, `${filename}_${formatDateForFilename()}`, format, sheetName);
    } catch (err) {
      console.error("Export error:", err);
      // Fallback to CSV if Excel fails
      if (format === "excel") {
        try {
          doExport(data, `${filename}_${formatDateForFilename()}`, "csv", sheetName);
        } catch (e) {
          console.error("CSV fallback failed:", e);
        }
      }
    }
    setIsOpen(false);
  };

  if (!data || data.length === 0) return null;

  const buttonClass =
    variant === "compact"
      ? "flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded text-xs transition-colors"
      : variant === "icon"
      ? "flex items-center justify-center w-8 h-8 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
      : "flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-lg text-sm transition-colors";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClass}
      >
        <Download className={variant === "compact" ? "w-3 h-3" : "w-4 h-4"} />
        {variant !== "icon" && label}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-1 w-44 bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1 z-50">
          <button
            onClick={() => handleExport("excel")}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Excel (.xlsx)
          </button>
          <button
            onClick={() => handleExport("csv")}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <FileText className="w-4 h-4 text-cyan-400" /> CSV (.csv)
          </button>
        </div>
      )}
    </div>
  );
}
