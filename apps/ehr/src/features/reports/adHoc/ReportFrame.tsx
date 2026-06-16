// Inline the Chart.js v4 UMD source into the sandboxed iframe (it sets window.Chart). Vite `?raw`
// gives us the file contents as a string; it never touches the network at runtime.
// Relative file path (not the bare "chart.js/…" specifier) so the package `exports` map — which
// doesn't expose dist/* — can't block it. chart.js is hoisted to the workspace root node_modules.
import { Box } from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import chartJsSource from '../../../../../../node_modules/chart.js/dist/chart.umd.js?raw';
import { AdHocTableGrid } from './AdHocTableGrid';
import { AdHocRow, DatasetSchema, ExtractedTable } from './types';

// The generated report code runs inside a SANDBOXED iframe:
//   - sandbox="allow-scripts" WITHOUT allow-same-origin → opaque origin, no access to the app's
//     DOM / cookies / localStorage / token.
//   - CSP blocks all network egress (connect-src 'none', default-src 'none'); 'unsafe-eval' is only
//     so we can run the model's code via `new Function`.
// Data is handed in via postMessage; the code renders into the iframe's own document.body. A hang or
// crash is contained to the frame (the parent's timeout recovers), and nothing can phone home.
//
// TABLES are an exception to "render in the frame": the trusted bootstrap extracts every <table> the
// report draws, HIDES it in the frame, and posts its data to the parent, which re-renders it as a
// full DataGrid (sortable / filterable / exportable — the same grid the rest of the reports area
// uses). So the frame shows only chart/KPI/other content; tables become real grids below it.
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

    // --- Lift tables out to the parent ----------------------------------------------------------
    // Tables the report renders are serialized, HIDDEN in the frame (along with their heading), and
    // posted to the parent, which re-renders them as full DataGrids. Re-runs on drill-down (a detail
    // table appended when a chart bar is clicked). 'extracted' accumulates in render order.
    var extracted = [];
    var tableSeq = 0;
    function cellOf(td) {
      var cell = { text: ((td && td.textContent) || '').trim().replace(/\\s+/g, ' ') };
      var a = td.querySelector ? td.querySelector('a') : null;
      if (a) {
        var href = a.getAttribute('href') || '';
        // Only app-internal single-slash links survive (same rule the egress guard enforces).
        if (href.charAt(0) === '/' && href.charAt(1) !== '/') cell.href = href;
      }
      return cell;
    }
    function rowCells(tr) { return [].map.call(tr.querySelectorAll('th,td'), cellOf); }
    function serializeTable(table) {
      var columns = [];
      var rows = [];
      var headRow = table.querySelector('thead tr');
      var bodySource;
      if (headRow) {
        columns = rowCells(headRow).map(function (c) { return c.text; });
        bodySource = table.querySelectorAll('tbody tr');
      } else {
        var trs = table.querySelectorAll('tr');
        if (trs.length) {
          columns = rowCells(trs[0]).map(function (c) { return c.text; });
          bodySource = [].slice.call(trs, 1);
        } else { bodySource = []; }
      }
      [].forEach.call(bodySource, function (tr) { rows.push(rowCells(tr)); });
      return { columns: columns, rows: rows };
    }
    function precedingHeading(table) {
      var prev = table.previousElementSibling;
      if (prev && /^H[1-4]$/.test(prev.tagName)) return prev;
      return table.querySelector('caption');
    }
    function hasNonTableContent() {
      if (document.querySelector('canvas')) return true;
      // innerText excludes display:none elements, so hidden tables/headings don't count.
      return document.body.innerText.trim().length > 0;
    }
    function publishTables() {
      send({ type: 'tables', tables: extracted, hasNonTableContent: hasNonTableContent() });
    }
    function extractTables() {
      var added = false;
      [].forEach.call(document.querySelectorAll('table'), function (table) {
        if (table.getAttribute('data-extracted')) return;
        if (!table.querySelector('td')) return; // header-only / empty — not worth a grid
        table.setAttribute('data-extracted', '1');
        var label = '';
        var heading = precedingHeading(table);
        if (heading) { label = (heading.textContent || '').trim(); heading.style.display = 'none'; }
        var s = serializeTable(table);
        table.style.display = 'none';
        extracted.push({ id: 't' + (tableSeq++), label: label, columns: s.columns, rows: s.rows });
        added = true;
      });
      return added;
    }

    // Report height on EVERY content change. Interactive reports grow the document after render
    // (e.g. a chart-click reveals more); a ResizeObserver on <body> keeps the iframe sized to its
    // VISIBLE content (extracted tables are hidden, so they don't count). De-duped by last height.
    var lastH = 0;
    function reportResize() {
      var h = measure();
      if (h !== lastH) { lastH = h; send({ type: 'resize', height: h }); }
    }
    try { new ResizeObserver(reportResize).observe(document.body); } catch (e) {}
    // Pull out tables on any DOM change too — drill-down detail tables are appended after render.
    // extractTables() marks each table, so hiding them can't loop.
    try {
      new MutationObserver(function () { if (extractTables()) publishTables(); }).observe(
        document.body, { childList: true, subtree: true }
      );
    } catch (e) {}

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
        extracted = [];
        tableSeq = 0;
        var fn = new Function('data', 'schema', 'Chart', msg.code);
        fn(msg.data, msg.schema, window.Chart);
        extractTables();
        publishTables(); // always — an empty list clears stale grids from the previous report
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
// documents otherwise resolve against about:srcdoc) and opens them in a new tab.
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

interface ReportFrameProps {
  code: string;
  data: AdHocRow[];
  schema: DatasetSchema;
  onError: (message: string) => void;
  /** Report title — used to name the per-table CSV export. */
  reportTitle?: string;
}

export function ReportFrame({ code, data, schema, onError, reportTitle }: ReportFrameProps): React.ReactElement {
  const ref = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadCountRef = useRef(0);
  const tornDownRef = useRef(false);
  const [height, setHeight] = useState(400);
  // Tables lifted out of the frame, re-rendered as DataGrids below. `hasNonTableContent` is false for
  // a pure-table report (no chart/KPI) — then the frame is collapsed and only the grids show.
  const [tables, setTables] = useState<ExtractedTable[]>([]);
  const [hasNonTableContent, setHasNonTableContent] = useState(true);

  // Egress backstop: legitimate report links open in a NEW tab (target=_blank), so they never
  // reload THIS frame. The srcdoc therefore loads exactly once. Any subsequent load event means the
  // frame navigated its own document — the one exfiltration channel CSP/sandbox can't block.
  const handleLoad = useCallback((): void => {
    loadCountRef.current += 1;
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
        tables?: ExtractedTable[];
        hasNonTableContent?: boolean;
      };
      if (msg?.type === 'ready') {
        readyRef.current = true;
        postRender();
      } else if (msg?.type === 'rendered') {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (typeof msg.height === 'number') setHeight(Math.min(Math.max(msg.height + 32, 160), 2400));
      } else if (msg?.type === 'resize') {
        if (typeof msg.height === 'number') setHeight(Math.min(Math.max(msg.height + 32, 160), 2400));
      } else if (msg?.type === 'tables') {
        // The frame extracted (and hid) the report's tables; render them as DataGrids below.
        setTables(Array.isArray(msg.tables) ? msg.tables : []);
        setHasNonTableContent(msg.hasNonTableContent !== false);
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
  }, [postRender, onError]);

  // (Re)render whenever the code or data changes and the frame is ready.
  useEffect(() => {
    postRender();
  }, [postRender]);

  return (
    <Box>
      {/* The frame stays mounted (it computes the tables), but collapses when there's nothing but
          tables to show. allow-popups (+ escape-sandbox) lets report links open app pages in a new
          tab via native anchor clicks; still no allow-same-origin. */}
      <Box sx={{ display: hasNonTableContent ? 'block' : 'none' }}>
        <iframe
          ref={ref}
          title="Ad-hoc report"
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          srcDoc={SRC_DOC}
          onLoad={handleLoad}
          style={{ width: '100%', height, border: '1px solid #e0e0e0', borderRadius: 4, background: '#fff' }}
        />
      </Box>
      {tables.map((t) => (
        <AdHocTableGrid key={t.id} table={t} reportTitle={reportTitle} />
      ))}
    </Box>
  );
}
