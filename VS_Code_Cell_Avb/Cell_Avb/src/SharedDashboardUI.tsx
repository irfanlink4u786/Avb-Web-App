import React, { useState } from "react";
import { FileSpreadsheet, RefreshCw } from "lucide-react";

export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    alert("No data to export");
    return;
  }
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header] ?? "";
          if (typeof value === "string" && (value.includes(",") || value.includes('"') || value.includes("\n"))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(",")
    ),
  ];
  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToExcel(data: any[], filename: string) {
  if (!data || data.length === 0) {
    alert("No data to export");
    return;
  }
  const headers = Object.keys(data[0]);
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:x="urn:schemas-microsoft-com:office:excel" 
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Sheet1</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            ${headers.map((h) => `<th>${h}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${data
            .map(
              (row) => `
            <tr>
              ${headers.map((h) => `<td>${row[h] ?? ""}</td>`).join("")}
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </body>
    </html>
  `;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


export function ExportButtonComponent({
  data,
  filename,
  label = "Export",
  format = "excel",
  variant = "primary",
}: {
  data: any[];
  filename: string;
  label?: string;
  format?: "excel" | "csv";
  variant?: "primary" | "secondary" | "danger" | "success";
}) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    if (!data || data.length === 0) {
      alert("No data available to export");
      return;
    }
    setIsExporting(true);
    try {
      if (format === "csv") {
        exportToCSV(data, filename);
      } else {
        exportToExcel(data, filename);
      }
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const variantStyles = {
    primary: "bg-cyan-500 hover:bg-cyan-400 text-slate-950",
    secondary: "bg-slate-700 hover:bg-slate-600 text-slate-200",
    danger: "bg-red-500 hover:bg-red-400 text-white",
    success: "bg-emerald-500 hover:bg-emerald-400 text-white",
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting || !data || data.length === 0}
      className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
        variantStyles[variant]
      } ${isExporting || !data || data.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {isExporting ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <FileSpreadsheet className="w-4 h-4" />
          {label}
        </>
      )}
    </button>
  );
}


export function SectionBanner({ icon, title, subtitle, gradient, className = "" }: { icon: React.ReactNode; title: string; subtitle: string; gradient: string; className?: string }) {
  return (
    <div className={`category-page-banner rounded-2xl bg-gradient-to-r ${gradient} border border-slate-200 p-5 shadow-sm ${className}`}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <h3 className="text-slate-900 font-extrabold text-lg" style={{ color: "#102a43" }}>{title}</h3>
          <p className="text-slate-600 text-sm" style={{ color: "#475569" }}>{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  Pre‑Vs‑Post Analysis Component (receives parsed sites)
// ============================================================

