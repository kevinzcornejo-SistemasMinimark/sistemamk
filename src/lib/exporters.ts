// Utilidades de exportación: CSV (abre en Excel) y PDF (vía print)

export function exportToCSV(filename: string, rows: Record<string, any>[], headers?: string[]) {
  if (rows.length === 0) return;
  const cols = headers ?? Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n;]/.test(s) ? `"${s}"` : s;
  };
  const csv = [
    cols.join(";"),
    ...rows.map((r) => cols.map((c) => escape(r[c])).join(";")),
  ].join("\n");
  // BOM para que Excel detecte UTF-8
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printHTML(title: string, bodyHTML: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      body{font-family:system-ui,Arial;font-size:12px;padding:24px;color:#0f172a}
      h1{font-size:18px;margin:0 0 4px} .meta{color:#64748b;font-size:11px;margin-bottom:14px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:11px}
      th{background:#f1f5f9;text-transform:uppercase;font-size:10px;letter-spacing:.04em}
      tr:nth-child(even) td{background:#f8fafc}
      .right{text-align:right} .total{font-weight:700;font-size:14px;color:#059669}
      @media print{button{display:none}}
    </style></head><body>${bodyHTML}
    <script>setTimeout(()=>window.print(),300);</script>
    </body></html>`);
  w.document.close();
}

// Imprime en formato ticket 80mm (ticketera térmica)
export function printTicket(title: string, bodyHTML: string) {
  const w = window.open("", "_blank", "width=380,height=700");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      @page{size:80mm auto;margin:0}
      *{box-sizing:border-box}
      body{font-family:'Courier New',monospace;font-size:11px;padding:6px 8px;color:#000;width:80mm}
      h1{font-size:14px;margin:0 0 2px;text-align:center}
      .meta{font-size:10px;margin-bottom:6px;text-align:center}
      .sep{border-top:1px dashed #000;margin:4px 0}
      table{width:100%;border-collapse:collapse}
      th,td{padding:2px 0;font-size:10px;text-align:left;vertical-align:top}
      th{border-bottom:1px dashed #000;text-transform:uppercase}
      .right{text-align:right}
      .total{font-weight:700;font-size:12px}
      .center{text-align:center}
      @media print{button{display:none}}
    </style></head><body>${bodyHTML}
    <script>setTimeout(()=>window.print(),300);</script>
    </body></html>`);
  w.document.close();
}
