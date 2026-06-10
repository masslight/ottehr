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
    window.addEventListener('message', function (ev) {
      var msg = ev && ev.data;
      if (!msg || msg.type !== 'render') return;
      try {
        document.body.innerHTML = '';
        var fn = new Function('data', 'schema', 'Chart', msg.code);
        fn(msg.data, msg.schema, window.Chart);
        var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
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

interface ReportFrameProps {
  code: string;
  data: AdHocRow[];
  schema: DatasetSchema;
  onError: (message: string) => void;
}

export function ReportFrame({ code, data, schema, onError }: ReportFrameProps): React.ReactElement {
  const ref = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [height, setHeight] = useState(400);

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
      const msg = ev.data as { type?: string; height?: number; message?: string };
      if (msg?.type === 'ready') {
        readyRef.current = true;
        postRender();
      } else if (msg?.type === 'rendered') {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (typeof msg.height === 'number') setHeight(Math.min(Math.max(msg.height + 32, 160), 2400));
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
      style={{ width: '100%', height, border: '1px solid #e0e0e0', borderRadius: 4, background: '#fff' }}
    />
  );
}
