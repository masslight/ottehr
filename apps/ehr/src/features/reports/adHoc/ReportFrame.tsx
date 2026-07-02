// Inline the Chart.js v4 UMD source into the sandboxed iframe (it sets window.Chart). Vite `?raw`
// gives us the file contents as a string; it never touches the network at runtime.
// Relative file path (not the bare "chart.js/…" specifier) so the package `exports` map — which
// doesn't expose dist/* — can't block it. chart.js is hoisted to the workspace root node_modules.
import { Box, Typography } from '@mui/material';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import chartJsSource from '../../../../../../node_modules/chart.js/dist/chart.umd.js?raw';
import { AdHocTableGrid } from './AdHocTableGrid';
import { repairGeneratedReportCode } from './repairReportCode';
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

    // Only an app-internal, single-slash relative href may navigate. Browsers STRIP tab/newline/CR
    // from URLs before parsing, so "/\\t/evil.com" becomes "//evil.com" (protocol-relative) — strip
    // them first, then reject a second char of '/' or backslash (a leading "/\\" normalizes to "//").
    // Closes the "external link carrying computed data in the query string" exfil channel.
    function isInternalHref(raw) {
      if (typeof raw !== 'string') return false;
      var h = raw.replace(/[\\t\\n\\r]/g, '');
      return h.charAt(0) === '/' && h.charAt(1) !== '/' && h.charAt(1) !== '\\\\';
    }

    // Structural egress lockdown: the frame may NOT open windows itself. Legitimate app-page links
    // are relayed to the PARENT (which opens them same-origin); everything else is dead. The sandbox
    // no longer grants allow-popups, so this is belt-and-braces against window.open exfiltration.
    try { window.open = function () { return null; }; } catch (e) {}

    // --- Lift tables out to the parent ----------------------------------------------------------
    // Tables the report renders are serialized, HIDDEN in the frame (along with their heading), and
    // posted to the parent, which re-renders them as full DataGrids. The list is rebuilt from the
    // LIVE DOM on every change (chart-click or table-click drill-down appends/replaces a detail
    // table): each table keeps a stable id so its parent grid doesn't remount, removed tables drop
    // out, and a replaced detail table leaves no stale grid behind.
    var extracted = [];
    var idSeq = 0;
    function cellOf(td) {
      var cell = { text: ((td && td.textContent) || '').trim().replace(/\\s+/g, ' ') };
      var a = td.querySelector ? td.querySelector('a') : null;
      if (a) {
        // Only app-internal links survive into a lifted-grid cell (same rule the egress guard uses).
        var href = a.getAttribute('href') || '';
        if (isInternalHref(href)) cell.href = href;
      }
      // Carry an inline cell background (heatmap shading) so the lifted grid can re-apply it.
      var bg = td && td.style ? td.style.backgroundColor : '';
      if (bg) cell.bg = bg;
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
    // innerText is NOT reliable here: once the PARENT collapses the iframe (display:none for a
    // table-only report), innerText falls back to textContent and would count the HIDDEN tables'
    // text — so a drill-down in a table-only report would wrongly expand a blank frame. Instead,
    // walk the DOM ourselves, skipping anything we hid with an inline display:none (the extracted
    // tables and their headings).
    function hasVisibleText(node) {
      if (!node) return false;
      if (node.nodeType === 3) return ((node.nodeValue || '').trim().length > 0);
      if (node.nodeType !== 1) return false;
      if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return false;
      if (node.style && node.style.display === 'none') return false;
      for (var child = node.firstChild; child; child = child.nextSibling) {
        if (hasVisibleText(child)) return true;
      }
      return false;
    }
    function hasNonTableContent() {
      try {
        if (document.querySelector('canvas')) return true;
        return hasVisibleText(document.body);
      } catch (e) { return true; } // fail open — never let this check break rendering
    }
    // Rebuild the lifted-table list from the CURRENT DOM and publish it. A table seen for the first
    // time gets a stable id + its heading hidden + itself hidden; on later rebuilds we just re-read
    // it. Removed tables (e.g. a previous drill-down detail replaced on a new click) simply aren't in
    // the DOM, so they drop out of the list.
    function extractAndPublish() {
      var list = [];
      [].forEach.call(document.querySelectorAll('table'), function (table) {
        if (!table.querySelector('td')) return; // header-only / empty — not worth a grid
        var id = table.getAttribute('data-adhoc-id');
        if (!id) {
          id = 't' + (idSeq++);
          table.setAttribute('data-adhoc-id', id);
          var heading = precedingHeading(table);
          table.setAttribute('data-adhoc-label', heading ? (heading.textContent || '').trim() : '');
          if (heading) heading.style.display = 'none';
          table.style.display = 'none';
        }
        var s = serializeTable(table);
        list.push({ id: id, label: table.getAttribute('data-adhoc-label') || '', columns: s.columns, rows: s.rows });
      });
      extracted = list;
      send({ type: 'tables', tables: extracted, hasNonTableContent: hasNonTableContent() });
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
    // Re-publish tables on any DOM change — drill-down detail tables are appended/replaced after
    // render. Only childList/subtree is observed (not attributes), so hiding a table doesn't re-loop.
    try {
      new MutationObserver(function () { extractAndPublish(); }).observe(
        document.body, { childList: true, subtree: true }
      );
    } catch (e) {}

    // Egress guard: the frame never navigates itself. EVERY anchor click is cancelled here; an
    // app-internal href is RELAYED to the parent, which opens it same-origin in a new tab. Anything
    // else — absolute, protocol-relative, "/\\evil", javascript:, etc. — is simply dropped. Routing
    // navigation through the parent (instead of letting the frame open it) is what lets the sandbox
    // drop allow-popups/allow-popups-to-escape-sandbox, closing the window.open exfil channel too.
    document.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest ? ev.target.closest('a') : null;
      if (!a) return;
      ev.preventDefault();
      ev.stopPropagation();
      var href = a.getAttribute('href') || '';
      if (isInternalHref(href)) send({ type: 'navigate', href: href });
    }, true);

    window.addEventListener('message', function (ev) {
      var msg = ev && ev.data;
      if (!msg) return;
      // Table-row drill-down: the parent grid posts the clicked row back; if the report registered a
      // window.reportRowClick handler, run it (it appends/replaces a detail table, which the
      // MutationObserver then lifts to the parent like any other table).
      if (msg.type === 'rowClick') {
        try {
          if (typeof window.reportRowClick === 'function') window.reportRowClick(msg.row, msg.tableLabel);
        } catch (e) {
          send({ type: 'error', message: (e && e.message) ? String(e.message) : String(e) });
        }
        extractAndPublish();
        reportResize();
        return;
      }
      if (msg.type !== 'render') return;
      try {
        document.body.innerHTML = '';
        extracted = [];
        idSeq = 0;
        window.reportRowClick = null; // drop any handler from a previous report
        // Support both shapes of generated code: top-level statements that render
        // directly, AND a renderReport(data, schema, Chart) function declaration
        // (older reports) that must be invoked. Call renderReport only when it is
        // defined AND nothing has rendered yet, so code that already calls it is
        // not run twice.
        var fn = new Function(
          'data',
          'schema',
          'Chart',
          msg.code +
            '\\n;if (typeof renderReport === "function" && !document.body.firstChild) { renderReport(data, schema, Chart); }'
        );
        fn(msg.data, msg.schema, window.Chart);
        extractAndPublish(); // always — an empty list clears stale grids from the previous report
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

// Parent-side twin of the frame's isInternalHref: only an app-internal, single-slash relative href
// may be opened. Browsers strip tab/newline/CR from URLs before parsing (so "/\t/x" → "//x"), so we
// strip those first, then reject a second char of '/' or backslash (a leading "/\" normalizes to
// "//"). Never trust an href the frame relays — re-validate here before window.open.
function isInternalHref(raw: string | undefined): raw is string {
  if (typeof raw !== 'string') return false;
  const h = raw.replace(/[\t\n\r]/g, '');
  return h.charAt(0) === '/' && h.charAt(1) !== '/' && h.charAt(1) !== '\\';
}

interface ReportFrameProps {
  code: string;
  data: AdHocRow[];
  schema: DatasetSchema;
  onError: (message: string) => void;
  /** Fired when the generated code renders without throwing — lets the page persist an auto-repaired
   *  report so it doesn't crash-then-retry on every open. */
  onRendered?: () => void;
  /** Report title — used to name the per-table CSV export. */
  reportTitle?: string;
}

export function ReportFrame({
  code,
  data,
  schema,
  onError,
  onRendered,
  reportTitle,
}: ReportFrameProps): React.ReactElement {
  const ref = useRef<HTMLIFrameElement>(null);
  const onRenderedRef = useRef(onRendered);
  onRenderedRef.current = onRendered;
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

  // Heal a known-bad generated pattern (`el.innerHTML +=` blanks already-drawn chart canvases)
  // right before the code runs — this is the single choke point through which BOTH freshly
  // generated and previously saved reports pass, so persisted broken code is repaired too.
  const repairedCode = useMemo(() => repairGeneratedReportCode(code), [code]);

  const postRender = useCallback(() => {
    const win = ref.current?.contentWindow;
    if (!readyRef.current || !win) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => onError('Report timed out — the generated code may be too slow or stuck.'),
      TIMEOUT_MS
    );
    win.postMessage({ type: 'render', code: repairedCode, data, schema }, '*');
  }, [repairedCode, data, schema, onError]);

  useEffect(() => {
    const handler = (ev: MessageEvent): void => {
      if (ev.source !== ref.current?.contentWindow) return;
      const msg = ev.data as {
        type?: string;
        height?: number;
        message?: string;
        href?: string;
        tables?: ExtractedTable[];
        hasNonTableContent?: boolean;
      };
      if (msg?.type === 'navigate') {
        // The frame relays app-internal link clicks here (it can no longer open windows itself).
        // Re-validate the href before opening — never trust the frame — then open it same-origin.
        if (isInternalHref(msg.href)) window.open(msg.href, '_blank', 'noopener');
        return;
      }
      if (msg?.type === 'ready') {
        readyRef.current = true;
        postRender();
      } else if (msg?.type === 'rendered') {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (typeof msg.height === 'number') setHeight(Math.min(Math.max(msg.height + 32, 160), 2400));
        onRenderedRef.current?.();
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

  // A row click in a lifted grid is posted back into the frame, where the report's optional
  // window.reportRowClick handler can render a detail (drill-down) table.
  const handleRowClick = useCallback((row: Record<string, string>, table: ExtractedTable): void => {
    ref.current?.contentWindow?.postMessage({ type: 'rowClick', tableLabel: table.label, row }, '*');
  }, []);

  return (
    <Box>
      {/* The frame stays mounted (it computes the tables), but collapses when there's nothing but
          tables to show. sandbox="allow-scripts" ONLY — no allow-same-origin, and deliberately no
          allow-popups/allow-popups-to-escape-sandbox: the frame can't open any window, so a report's
          window.open can't exfiltrate. App-page links are relayed to the parent (the 'navigate'
          message), which opens them same-origin in a new tab. */}
      <Box sx={{ display: hasNonTableContent ? 'block' : 'none' }}>
        <iframe
          ref={ref}
          title="Ad-hoc report"
          sandbox="allow-scripts"
          srcDoc={SRC_DOC}
          onLoad={handleLoad}
          style={{ width: '100%', height, border: '1px solid #e0e0e0', borderRadius: 4, background: '#fff' }}
        />
      </Box>
      {tables.map((t) => (
        <AdHocTableGrid key={t.id} table={t} reportTitle={reportTitle} onRowClick={handleRowClick} />
      ))}
      {/* The frame collapses when there's no non-table content; if there are also no lifted tables the
          report rendered nothing — say so explicitly instead of leaving a silent blank. */}
      {!hasNonTableContent && tables.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2, fontStyle: 'italic' }}>
          This report produced no output. Try refining your request or regenerating.
        </Typography>
      )}
    </Box>
  );
}
