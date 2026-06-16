// Inline the Chart.js v4 UMD source into the sandboxed iframe (it sets window.Chart). Vite `?raw`
// gives us the file contents as a string; it never touches the network at runtime.
// Relative file path (not the bare "chart.js/…" specifier) so the package `exports` map — which
// doesn't expose dist/* — can't block it. chart.js is hoisted to the workspace root node_modules.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import chartJsSource from '../../../../../../node_modules/chart.js/dist/chart.umd.js?raw';
import { AdHocRow, DatasetSchema } from './types';

// The generated report code runs inside a SANDBOXED iframe:
//   - sandbox="allow-scripts" WITHOUT allow-same-origin → opaque origin, no access to the app's
//     DOM / cookies / localStorage / token.
//   - CSP blocks all network egress (connect-src 'none', default-src 'none'); 'unsafe-eval' is only
//     so we can run the model's code via `new Function`.
// Data is handed in via postMessage; the code renders into the iframe's own document.body. A hang or
// crash is contained to the frame (the parent's timeout recovers), and nothing can phone home.
const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data:',
  "connect-src 'none'",
  // Redundant with the sandbox (no allow-forms already blocks form submission) but explicit:
  // no form may post anywhere.
  "form-action 'none'",
].join('; ');

const BASE_CSS = `
  body { font-family: Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; color: #1a1a1a; margin: 16px; }
  h1,h2,h3 { color: #0a2e5c; font-weight: 600; margin: 0 0 12px; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; margin: 8px 0; }
  th, td { border: 1px solid #e0e0e0; padding: 6px 10px; text-align: left; }
  th { background: #f5f7fa; font-weight: 600; }
  tr:nth-child(even) td { background: #fafafa; }
  canvas { max-width: 100%; }
  .kpi { font-size: 48px; font-weight: 700; color: #1565c0; }
`;

const BOOTSTRAP = `
  (function () {
    function send(m) { try { parent.postMessage(m, '*'); } catch (e) {} }
    function measure() { return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight); }

    // --- Per-table CSV export -------------------------------------------------------------------
    // The host wrapper (trusted code, NOT the generated report) decorates every <table> the report
    // renders with a small "Export CSV" icon, so tabular reports get the same export affordance as
    // the rest of the reports area. Chart/KPI-only reports render no <table> and get no icon. The
    // sandbox can't trigger a download itself, so the click serializes that one table and posts it to
    // the parent, which does the file download.
    function cellText(c) { return ((c && c.textContent) || '').trim().replace(/\\s+/g, ' '); }
    function serializeTable(table) {
      var headers = [];
      var bodyRows = [];
      var headRow = table.querySelector('thead tr');
      var rowsSource;
      if (headRow) {
        headers = [].map.call(headRow.querySelectorAll('th,td'), cellText);
        rowsSource = table.querySelectorAll('tbody tr');
      } else {
        var trs = table.querySelectorAll('tr');
        if (trs.length) { headers = [].map.call(trs[0].querySelectorAll('th,td'), cellText); rowsSource = [].slice.call(trs, 1); }
        else { rowsSource = []; }
      }
      [].forEach.call(rowsSource, function (tr) { bodyRows.push([].map.call(tr.querySelectorAll('th,td'), cellText)); });
      return { headers: headers, rows: bodyRows };
    }
    function tableLabel(table) {
      var cap = table.querySelector('caption');
      if (cap && cap.textContent.trim()) return cap.textContent.trim();
      var prev = table.previousElementSibling;
      // Skip our own export bar when looking back for a heading.
      if (prev && prev.getAttribute && prev.getAttribute('data-export-bar')) prev = prev.previousElementSibling;
      if (prev && /^H[1-4]$/.test(prev.tagName)) return prev.textContent.trim();
      return '';
    }
    function decorateTables() {
      var tables = document.querySelectorAll('table');
      [].forEach.call(tables, function (table) {
        if (table.getAttribute('data-export-decorated')) return;
        // A table needs at least one data cell to be worth exporting.
        if (!table.querySelector('td')) return;
        table.setAttribute('data-export-decorated', '1');
        var label = tableLabel(table);
        var bar = document.createElement('div');
        bar.setAttribute('data-export-bar', '1');
        bar.style.cssText = 'display:flex;justify-content:flex-end;margin:8px 0 -2px;';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.title = 'Export this table to CSV';
        btn.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font:600 12px Roboto,system-ui,sans-serif;' +
          'color:#1565c0;background:#fff;border:1px solid #c5d6ea;border-radius:4px;padding:3px 8px;cursor:pointer;';
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
          '<path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/></svg>Export CSV';
        btn.addEventListener('click', function () {
          var t = serializeTable(table);
          send({ type: 'export-table', label: label, headers: t.headers, rows: t.rows });
        });
        bar.appendChild(btn);
        table.parentNode.insertBefore(bar, table);
      });
    }

    // Report height on EVERY content change, not just the initial render. Interactive reports
    // (e.g. a detail table appended when a chart bar is clicked) grow the document after render;
    // without this the iframe stays its original height and the new content renders below the
    // visible area. A ResizeObserver on <body> fires on those mutations; we de-dupe by last height.
    var lastH = 0;
    function reportResize() {
      var h = measure();
      if (h !== lastH) { lastH = h; send({ type: 'resize', height: h }); }
    }
    try { new ResizeObserver(reportResize).observe(document.body); } catch (e) {}
    // Decorate tables on any DOM change too — drill-down detail tables are appended after render.
    // decorateTables() is idempotent (marks each table), so inserting our own bars can't loop.
    try { new MutationObserver(decorateTables).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    // Egress guard: only app-internal links may navigate. Anchors must use a single-slash relative
    // href (resolved against the <base> to the EHR origin); anything else — absolute URLs,
    // protocol-relative, javascript:, etc. — is cancelled. This closes the "render an external
    // link carrying computed data in the URL" channel.
    document.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest ? ev.target.closest('a') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (!(href.charAt(0) === '/' && href.charAt(1) !== '/')) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    }, true);
    window.addEventListener('message', function (ev) {
      var msg = ev && ev.data;
      if (!msg || msg.type !== 'render') return;
      try {
        document.body.innerHTML = '';
        var fn = new Function('data', 'schema', 'Chart', msg.code);
        fn(msg.data, msg.schema, window.Chart);
        decorateTables();
        var h = measure();
        lastH = h;
        send({ type: 'rendered', height: h });
      } catch (e) {
        send({ type: 'error', message: (e && e.message) ? String(e.message) : String(e) });
      }
    });
    send({ type: 'ready' });
  })();
`;

// Built once. The generated code is NOT embedded here — it arrives via postMessage — so there is no
// HTML-injection surface in the document itself.
// The <base> tag makes relative hrefs in generated reports resolve against the EHR origin (srcdoc
// documents otherwise resolve against about:srcdoc) and opens them in a new tab — so a report can
// link a row to its chart with a plain <a href="/in-person/{id}/...">.
const SRC_DOC = [
  '<!DOCTYPE html><html><head><meta charset="utf-8">',
  `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
  `<base href="${window.location.origin}/" target="_blank">`,
  `<style>${BASE_CSS}</style>`,
  // Guard against a stray "</script>" inside the minified lib closing our tag early.
  `<script>${chartJsSource.replace(/<\/script/gi, '<\\/script')}</script>`,
  '</head><body>',
  `<script>${BOOTSTRAP}</script>`,
  '</body></html>',
].join('');

const TIMEOUT_MS = 8000;

// CSV cell escaping per RFC 4180; a leading BOM makes Excel read UTF-8 correctly.
function buildCsv(headers: string[], rows: string[][]): string {
  const esc = (v: string): string => (/[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
  const lines: string[] = [];
  if (headers.length) lines.push(headers.map(esc).join(','));
  for (const r of rows) lines.push(r.map(esc).join(','));
  return '﻿' + lines.join('\r\n');
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'ad-hoc-report'
  );
}

// The download itself runs in the parent (same-origin) — the sandboxed frame can't trigger one.
function downloadTableCsv(reportTitle: string | undefined, label: string, headers: string[], rows: string[][]): void {
  const csv = buildCsv(headers, rows);
  const namePart = slugify(reportTitle || 'ad-hoc-report');
  const labelPart = label ? '-' + slugify(label) : '';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${namePart}${labelPart}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface ReportFrameProps {
  code: string;
  data: AdHocRow[];
  schema: DatasetSchema;
  onError: (message: string) => void;
  /** Used to name the exported CSV file (the report's title). */
  reportTitle?: string;
}

export function ReportFrame({ code, data, schema, onError, reportTitle }: ReportFrameProps): React.ReactElement {
  const ref = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadCountRef = useRef(0);
  const tornDownRef = useRef(false);
  const [height, setHeight] = useState(400);

  // Egress backstop: legitimate report links open in a NEW tab (target=_blank), so they never
  // reload THIS frame. The srcdoc therefore loads exactly once. Any subsequent load event means the
  // frame navigated its own document — the one exfiltration channel CSP/sandbox can't block
  // (self-navigation to an external URL). We can't un-send that first request, but we blank the
  // frame to stop any repeat/streamed leak and surface the event loudly. (Full prevention requires
  // a frame-src allowlist on the app's CSP — tracked separately.)
  const handleLoad = useCallback((): void => {
    loadCountRef.current += 1;
    // Fire once: blanking the frame re-triggers `load`, so guard against re-entry.
    if (loadCountRef.current > 1 && !tornDownRef.current) {
      tornDownRef.current = true;
      const frame = ref.current;
      if (frame) frame.srcdoc = '<!DOCTYPE html><html><body></body></html>';

      console.error('[AdHocReport] report frame attempted to navigate away — blanked for safety');
      onError('The report was stopped because it attempted to navigate away from the page.');
    }
  }, [onError]);

  const postRender = useCallback(() => {
    const win = ref.current?.contentWindow;
    if (!readyRef.current || !win) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => onError('Report timed out — the generated code may be too slow or stuck.'),
      TIMEOUT_MS
    );
    win.postMessage({ type: 'render', code, data, schema }, '*');
  }, [code, data, schema, onError]);

  useEffect(() => {
    const handler = (ev: MessageEvent): void => {
      if (ev.source !== ref.current?.contentWindow) return;
      const msg = ev.data as {
        type?: string;
        height?: number;
        message?: string;
        label?: string;
        headers?: string[];
        rows?: string[][];
      };
      if (msg?.type === 'ready') {
        readyRef.current = true;
        postRender();
      } else if (msg?.type === 'rendered') {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (typeof msg.height === 'number') setHeight(Math.min(Math.max(msg.height + 32, 160), 2400));
      } else if (msg?.type === 'resize') {
        // Post-render content change (e.g. a detail table appended on chart click). Grow the iframe
        // so it stays visible; don't touch the render timeout — that's already cleared by 'rendered'.
        if (typeof msg.height === 'number') setHeight(Math.min(Math.max(msg.height + 32, 160), 2400));
      } else if (msg?.type === 'export-table') {
        // A per-table "Export CSV" icon was clicked inside the frame; do the download here.
        downloadTableCsv(reportTitle, msg.label ?? '', msg.headers ?? [], msg.rows ?? []);
      } else if (msg?.type === 'error') {
        if (timerRef.current) clearTimeout(timerRef.current);
        onError(msg.message || 'The report code threw an error.');
      }
    };
    window.addEventListener('message', handler);
    return () => {
      window.removeEventListener('message', handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [postRender, onError, reportTitle]);

  // (Re)render whenever the code or data changes and the frame is ready.
  useEffect(() => {
    postRender();
  }, [postRender]);

  return (
    // allow-popups (+ escape-sandbox so the opened tab is a NORMAL tab, not a sandboxed one) lets
    // report links open app pages in a new tab via native anchor clicks — which carry the user
    // gesture, so they aren't popup-blocked. Still no allow-same-origin: the report document stays
    // an opaque origin with no access to the app's DOM/storage, and CSP still blocks all
    // network egress from within the frame.
    <iframe
      ref={ref}
      title="Ad-hoc report"
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      srcDoc={SRC_DOC}
      onLoad={handleLoad}
      style={{ width: '100%', height, border: '1px solid #e0e0e0', borderRadius: 4, background: '#fff' }}
    />
  );
}
