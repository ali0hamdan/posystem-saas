/**
 * Client-side export helpers (no server round-trip).
 * Financial figures should come from API responses already computed with sale-time COGS.
 */

import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Flatten nested objects one level for spreadsheet cells. */
export function flattenRow(obj: unknown, prefix = ''): Record<string, string | number> {
  if (obj === null || obj === undefined) return {};
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    return { [prefix || 'value']: String(obj) };
  }
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      Object.assign(out, flattenRow(v, key));
    } else if (v instanceof Date) {
      out[key] = v.toISOString();
    } else {
      out[key] = typeof v === 'number' || typeof v === 'string' ? v : JSON.stringify(v);
    }
  }
  return out;
}

export async function exportJsonToExcel(filename: string, sheetName: string, rows: Record<string, unknown>[]) {
  const flat = rows.map((r) => flattenRow(r));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 31));

  const data = flat.length ? flat : [{ note: 'No rows' }];
  const headers = Object.keys(data[0]);
  ws.addRow(headers);
  for (const row of data) ws.addRow(headers.map((h) => row[h] ?? ''));

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportTableToPdf(
  title: string,
  filename: string,
  columns: { header: string; dataKey: string }[],
  rows: Record<string, unknown>[],
) {
  const doc = new jsPDF({ orientation: rows.length > 12 ? 'landscape' : 'portrait', unit: 'pt' });
  doc.setFontSize(14);
  doc.text(title, 40, 36);
  const head = [columns.map((c) => c.header)];
  const body = rows.map((r) => columns.map((c) => String(r[c.dataKey] ?? '')));
  autoTable(doc, {
    head,
    body,
    startY: 48,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export function printHtmlReport(title: string, innerBodyHtml: string): boolean {
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) return false;
  const safeTitle = escapeHtml(title);
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${safeTitle}</title>
    <style>
      body{font-family:system-ui,sans-serif;padding:24px;color:#111}
      h1{font-size:20px}
      table{border-collapse:collapse;width:100%;margin-top:16px;font-size:12px}
      th,td{border:1px solid #ccc;padding:6px;text-align:left}
      th{background:#f3f4f6}
      .meta{color:#555;font-size:12px;margin-bottom:16px}
    </style></head><body>
    <h1>${safeTitle}</h1>
    <p class="meta">Printed ${new Date().toLocaleString()}</p>
    ${innerBodyHtml}
    </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
    w.close();
  }, 250);
  return true;
}

export function tableFromColumns(
  columns: { header: string; dataKey: string }[],
  rows: Record<string, unknown>[],
): string {
  const th = columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join('');
  const tr = rows
    .map(
      (r) =>
        `<tr>${columns.map((c) => `<td>${escapeHtml(String(r[c.dataKey] ?? ''))}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}
