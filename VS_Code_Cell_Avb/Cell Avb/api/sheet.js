import supabase from './db-client.js';

// Google Sheets configuration
const DEFAULT_SHEET_ID = '1Bu4lneVsXvoHdiiJtJvzKSVq0MrTHQOqvH38w7MlNPk';
const API_KEY = process.env.GOOGLE_SHEETS_API_KEY || 'AIzaSyAH64iXcHsZjj4WIQNvv2xqvpLS6JID5dE';

// Convert a 1-based column number to a spreadsheet letter (1 -> A, 27 -> AA)
function columnToLetter(n) {
  let letter = '';
  while (n > 0) {
    const mod = (n - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const sheetId = req.query.id || DEFAULT_SHEET_ID;

    // 1. Fetch spreadsheet metadata to discover sheet name + dimensions
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${API_KEY}`;
    const metaRes = await fetch(metaUrl);
    if (!metaRes.ok) {
      const errText = await metaRes.text();
      return res.status(metaRes.status).json({
        error: `Google Sheets API error: ${metaRes.status}`,
        detail: errText,
      });
    }
    const meta = await metaRes.json();

    const sheetTitle = meta.title || 'Sheet';
    const sheets = meta.sheets || [];
    
    // If a specific tab is requested, find it; otherwise use the first sheet
    let targetSheet = sheets[0];
    if (req.query.tab) {
      targetSheet = sheets.find(s => s.properties?.title === req.query.tab) || sheets[0];
    }
    
    const tabTitle = targetSheet?.properties?.title || 'Sheet1';
    const grid = targetSheet?.properties?.gridProperties || {};
    const rowCount = grid.rowCount || 10000;
    // The sheet metadata columnCount (190) is stale — LS columns start at GJ (192).
    // Add a buffer to ensure we capture all columns including LS daily data.
    const colCount = (grid.columnCount || 26) + 20;
    const colLetter = columnToLetter(colCount);
    const range = `${tabTitle}!A1:${colLetter}${rowCount}`;

    // 2. Fetch all values
    const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${API_KEY}`;
    const valuesRes = await fetch(valuesUrl);
    if (!valuesRes.ok) {
      const errText = await valuesRes.text();
      return res.status(valuesRes.status).json({
        error: `Google Sheets values error: ${valuesRes.status}`,
        detail: errText,
      });
    }
    const valuesData = await valuesRes.json();

    const allRows = valuesData.values || [];
    if (allRows.length === 0) {
      return res.status(200).json({
        sheetTitle,
        tabTitle,
        headers: [],
        rows: [],
        totalRows: 0,
        fetchedAt: new Date().toISOString(),
      });
    }

    // 3. Transform arrays-of-arrays into array of objects.
    // IMPORTANT: The sheet has DUPLICATE date headers (AVB daily data at AX-CB
    // and LS daily data at GJ-HN both use "1-Jun-26" etc.). To avoid data loss,
    // we prefix duplicate headers with their column index so each stays unique.
    const rawHeaders = allRows[0].map((h) => (h ?? '').toString().trim());
    const headerCount = {};
    const headers = rawHeaders.map((h, idx) => {
      if (!h) return `__col_${idx}`;
      headerCount[h] = (headerCount[h] || 0) + 1;
      // If this header appears more than once, suffix with column index
      if (headerCount[h] > 1) {
        return `${h}__${idx}`;
      }
      return h;
    });

    const dataRows = allRows.slice(1)
      .filter((row) => row.some((cell) => (cell ?? '').toString().trim() !== ''))
      .map((row) => {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = (row[i] ?? '').toString().trim();
        });
        return obj;
      });

    return res.status(200).json({
      sheetTitle,
      tabTitle,
      headers,
      rows: dataRows,
      totalRows: dataRows.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Sheet API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
