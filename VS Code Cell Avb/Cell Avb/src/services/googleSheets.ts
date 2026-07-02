// Re-export SheetPayload so other files can import it from this module
export type { SheetPayload } from "../types";

import { SheetPayload } from "../types";

const DEFAULT_SHEET_ID = '1Bu4lneVsXvoHdiiJtJvzKSVq0MrTHQOqvH38w7MlNPk';
const API_KEY = 'AIzaSyAH64iXcHsZjj4WIQNvv2xqvpLS6JID5dE';

function columnToLetter(n: number): string {
  let letter = '';
  while (n > 0) {
    const mod = (n - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

export async function fetchGoogleSheet(
  sheetId: string = DEFAULT_SHEET_ID,
  tab?: string
): Promise<SheetPayload> {
  console.log('🔄 Fetching from Google Sheets API directly...');
  
  try {
    // Step 1: Get sheet metadata to find the sheet name and dimensions
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${API_KEY}`;
    console.log('📡 Fetching metadata...');
    
    const metaRes = await fetch(metaUrl);
    if (!metaRes.ok) {
      const errText = await metaRes.text();
      console.error('❌ Metadata error:', errText);
      throw new Error(`Failed to fetch sheet metadata: ${metaRes.status}`);
    }
    
    const meta = await metaRes.json();
    const sheetTitle = meta.title || 'Sheet';
    const sheets = meta.sheets || [];
    
    // Find the target sheet
    let targetSheet = sheets[0];
    if (tab) {
      targetSheet = sheets.find((s: any) => s.properties?.title === tab) || sheets[0];
    }
    
    const tabTitle = targetSheet?.properties?.title || 'Sheet1';
    const grid = targetSheet?.properties?.gridProperties || {};
    const rowCount = grid.rowCount || 10000;
    const colCount = (grid.columnCount || 26) + 20;
    const colLetter = columnToLetter(colCount);
    const range = `${tabTitle}!A1:${colLetter}${rowCount}`;
    
    console.log(`📊 Fetching range: ${range}`);
    
    // Step 2: Get the actual data
    const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${API_KEY}`;
    const valuesRes = await fetch(valuesUrl);
    
    if (!valuesRes.ok) {
      const errText = await valuesRes.text();
      console.error('❌ Values error:', errText);
      throw new Error(`Failed to fetch sheet data: ${valuesRes.status}`);
    }
    
    const valuesData = await valuesRes.json();
    const allRows = valuesData.values || [];

    if (allRows.length === 0) {
      console.warn('⚠️ No data found in sheet');
      return {
        sheetTitle,
        tabTitle,
        headers: [],
        rows: [],
        totalRows: 0,
        fetchedAt: new Date().toISOString(),
      };
    }

    // Process headers - handle duplicates by adding column index
    const rawHeaders = allRows[0].map((h: any) => (h ?? '').toString().trim());
    const headerCount: Record<string, number> = {};
    const headers = rawHeaders.map((h: string, idx: number) => {
      if (!h) return `__col_${idx}`;
      headerCount[h] = (headerCount[h] || 0) + 1;
      if (headerCount[h] > 1) {
        return `${h}__${idx}`;
      }
      return h;
    });

    // Process data rows
    const dataRows = allRows.slice(1)
      .filter((row: any[]) => row.some((cell: any) => (cell ?? '').toString().trim() !== ''))
      .map((row: any[]) => {
        const obj: Record<string, string> = {};
        headers.forEach((h: string, i: number) => {
          obj[h] = (row[i] ?? '').toString().trim();
        });
        return obj;
      });

    console.log(`✅ Successfully fetched ${dataRows.length} rows with ${headers.length} columns`);

    return {
      sheetTitle,
      tabTitle,
      headers,
      rows: dataRows,
      totalRows: dataRows.length,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ fetchGoogleSheet error:', error);
    throw error;
  }
}