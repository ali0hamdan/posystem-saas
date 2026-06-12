/**
 * Renders a clear, non-silent failure window when desktop startup can't
 * bring up Postgres / migrations / backend. We render a static data: URL so
 * we never depend on the (un-built) renderer.
 */
const { BrowserWindow } = require('electron');
const { getPaths } = require('./desktop-paths.cjs');

const TITLES = {
  paths: 'Local data directory failed',
  postgres: 'Local database failed to start',
  backup: 'Pre-migration backup failed',
  migrate: 'Database migration failed',
  backend: 'Local server failed to start',
  health: 'Local server is not responding',
  unknown: 'Nezhin POS failed to start',
};

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function render({ step, code, message, events = [] }) {
  const { logsDir } = getPaths();
  const title = TITLES[step] || TITLES.unknown;
  const trace = events
    .map(
      (e) =>
        `<tr><td>${escapeHtml(e.step)}</td><td>${escapeHtml(e.phase)}</td><td>${escapeHtml(
          e.reason || e.error || e.url || '',
        )}</td></tr>`,
    )
    .join('');
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 14px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; padding: 32px; max-width: 760px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  .sub { color: #888; margin-bottom: 20px; }
  pre { background: rgba(127,127,127,0.12); padding: 12px; border-radius: 6px; white-space: pre-wrap; word-break: break-word; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
  td, th { padding: 4px 8px; border-bottom: 1px solid rgba(127,127,127,0.2); text-align: left; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; background: rgba(220,80,80,0.15); color: #c33; font-size: 12px; font-weight: 600; }
  .path { font-family: ui-monospace, Consolas, monospace; }
</style></head>
<body>
  <span class="pill">${escapeHtml(code || 'ERROR')}</span>
  <h1>${escapeHtml(title)}</h1>
  <div class="sub">Step: ${escapeHtml(step || 'unknown')}</div>
  <p>${escapeHtml(message || 'An unknown error occurred while starting Nezhin POS.')}</p>
  <p>Logs are in:</p>
  <pre class="path">${escapeHtml(logsDir)}</pre>
  <details><summary>Startup trace</summary>
    <table><thead><tr><th>step</th><th>phase</th><th>info</th></tr></thead>
      <tbody>${trace}</tbody>
    </table>
  </details>
</body></html>`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

function show(failure) {
  const win = new BrowserWindow({
    width: 720,
    height: 560,
    title: 'Nezhin POS',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.removeMenu();
  win.loadURL(render(failure)).catch(() => {});
  return win;
}

module.exports = { show, render };
