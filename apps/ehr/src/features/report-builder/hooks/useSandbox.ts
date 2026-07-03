// SPA side of the report sandbox. The hook builds the iframe content (runtime bundle), hands it the
// generated code + fetched data at creation, and surfaces the frame's whitelisted integration
// events. The SPA renders no part of the report and never reads the frame's DOM.
//
// Security properties (must not regress):
//   - sandbox="allow-scripts" and nothing else: no allow-same-origin (opaque origin — no access to
//     the app's DOM / cookies / storage / token), no allow-popups (no window.open inside).
//   - srcDoc (not a served URL); generated code is NOT in the HTML — it arrives via postMessage, so
//     no HTML-injection surface.
//   - CSP: default-src 'none', connect-src 'none' — no network egress. Inline script/style + eval
//     allowed only because the runtime bundle and generated code run from strings.
//   - Only JSON crosses the boundary. Incoming messages are frame lifecycle
//     ({ type: ready|rendered|resize|error }) or events validated against AdHocFrameEventSchema;
//     everything else is ignored.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdHocFrameEventSchema, AdHocRow, LlmDatasetSchema } from 'utils';
import { showAdHocDebugLog } from '../debug';
import { hrefForOpenLink } from './links';

const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data:',
  "connect-src 'none'",
  // Redundant with the sandbox (no allow-forms already blocks form submission) but explicit.
  "form-action 'none'",
].join('; ');

const BASE_CSS = `
  html, body { margin: 0; padding: 12px 4px 4px; background: #fff; }
`;

// The runtime bundle (React + MUI/DataGridPro + ECharts + Vega-Lite + Report components +
// transpiler) is ~3 MB (~1 MB gzip), so it must NOT live in the app's main chunk. A dynamic
// import() makes Rollup emit it as its own lazy chunk, fetched only when a report frame first mounts
// (then browser-cached). The srcDoc is assembled once and reused — only the STATIC bundle is
// embedded, never the generated code.
function buildSrcDoc(runtimeBundle: string): string {
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    `<style>${BASE_CSS}</style>`,
    '</head><body><div id="root"></div>',
    // Guard against a stray "</script>" inside the minified bundle closing our tag early.
    `<script>${runtimeBundle.replace(/<\/script/gi, '<\\/script')}</script>`,
    '</body></html>',
  ].join('');
}

let srcDocPromise: Promise<string> | null = null;
// Load the runtime chunk + assemble the srcDoc once per app session; every frame reuses the string.
function loadSrcDoc(): Promise<string> {
  return (srcDocPromise ??= import('virtual:adhoc-report-runtime').then((m) => buildSrcDoc(m.default)));
}

const TIMEOUT_MS = 10000;
const MIN_HEIGHT = 160;
const MAX_HEIGHT = 4000;

// Distinguishable timeout message: a watchdog timeout means "slow or stuck", NOT "wrong code" — the
// caller shows it without regenerating (the code may be fine, merely slow here).
export const SANDBOX_TIMEOUT_MESSAGE = 'Report timed out — the generated code may be too slow or stuck.';

// Same DataGridPro license key the app uses — the frame is a separate window and activates its own copy.
const MUI_X_LICENSE_KEY: string | undefined = import.meta.env.VITE_APP_MUI_X_LICENSE_KEY;

export interface UseSandboxOptions {
  /** The generated JSX artifact (the body of buildReport) — from generate or a saved report,
   *  exactly as shown in the code preview. The frame's runtime transpiles it before execution. */
  code: string;
  /** The fetched, Zod-validated rows. Provided to the frame at creation; never sent to the LLM. */
  data: AdHocRow[];
  schema: LlmDatasetSchema;
  /** Generation/runtime failure inside the frame (drives the bounded auto-repair). */
  onError: (message: string) => void;
  /** The report rendered cleanly. */
  onRendered?: () => void;
}

export interface UseSandbox {
  /** Spread onto the <iframe>. Null until the runtime bundle chunk has loaded — the frame must not
   *  be mounted before then (an empty-then-real srcDoc swap would look like a navigation). */
  frameProps: {
    ref: React.RefObject<HTMLIFrameElement>;
    sandbox: string;
    srcDoc: string;
    onLoad: () => void;
    style: React.CSSProperties;
    title: string;
  } | null;
}

export function useSandbox({ code, data, schema, onError, onRendered }: UseSandboxOptions): UseSandbox {
  const ref = useRef<HTMLIFrameElement>(null);
  const onRenderedRef = useRef(onRendered);
  onRenderedRef.current = onRendered;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const readyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadCountRef = useRef(0);
  const tornDownRef = useRef(false);
  const [height, setHeight] = useState(400);
  // The runtime bundle is code-split into its own chunk; load it before mounting the frame.
  const [srcDoc, setSrcDoc] = useState<string | null>(null);

  // Egress backstop: the srcdoc loads exactly once (nothing inside navigates the frame). A later
  // load event means the frame navigated its own document — the one exfiltration channel CSP/sandbox
  // can't block — so blank it.
  const handleLoad = useCallback((): void => {
    loadCountRef.current += 1;
    if (loadCountRef.current > 1 && !tornDownRef.current) {
      tornDownRef.current = true;
      const frame = ref.current;
      if (frame) frame.srcdoc = '<!DOCTYPE html><html><body></body></html>';
      console.error('[AdHocReport] report frame attempted to navigate away — blanked for safety');
      onErrorRef.current('The report was stopped because it attempted to navigate away from the page.');
    }
  }, []);

  const postRender = useCallback(() => {
    const win = ref.current?.contentWindow;
    if (!readyRef.current || !win) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onErrorRef.current(SANDBOX_TIMEOUT_MESSAGE), TIMEOUT_MS);
    win.postMessage({ type: 'render', code, data, schema, muiLicenseKey: MUI_X_LICENSE_KEY }, '*');
  }, [code, data, schema]);

  // Whitelisted integration events. The only v1 event is openLink: validate against the shared
  // schema, build the URL on THIS side, open in a new tab (the frame itself has no allow-popups).
  const handleFrameEvent = useCallback((raw: unknown): void => {
    const parsed = AdHocFrameEventSchema.safeParse(raw);
    if (!parsed.success) {
      showAdHocDebugLog('sandbox', 'ignored a non-whitelisted frame event', raw);
      return;
    }
    const event = parsed.data;
    if (event.event === 'openLink') {
      const href = hrefForOpenLink(event.options);
      if (href) window.open(`${window.location.origin}${href}`, '_blank', 'noopener');
      else showAdHocDebugLog('sandbox', 'openLink rejected by the SPA whitelist', event.options);
    }
  }, []);

  // Pull the code-split runtime chunk once, then mount the frame. A load failure surfaces as a
  // render error rather than a silently blank frame.
  useEffect(() => {
    let alive = true;
    void loadSrcDoc()
      .then((doc) => {
        if (alive) setSrcDoc(doc);
      })
      .catch((e) => {
        console.error('[AdHocReport] failed to load the report runtime bundle', e);
        if (alive) onErrorRef.current('Could not load the report runtime.');
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const handler = (ev: MessageEvent): void => {
      if (ev.source !== ref.current?.contentWindow) return;
      const msg = ev.data as
        | { type?: string; height?: number; message?: string; fatal?: boolean; event?: string }
        | undefined;
      if (!msg) return;
      if (typeof msg.event === 'string') {
        handleFrameEvent(msg);
        return;
      }
      if (msg.type === 'ready') {
        readyRef.current = true;
        postRender();
      } else if (msg.type === 'rendered') {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (typeof msg.height === 'number') setHeight(Math.min(Math.max(msg.height + 24, MIN_HEIGHT), MAX_HEIGHT));
        onRenderedRef.current?.();
      } else if (msg.type === 'resize') {
        if (typeof msg.height === 'number') setHeight(Math.min(Math.max(msg.height + 24, MIN_HEIGHT), MAX_HEIGHT));
      } else if (msg.type === 'error') {
        // fatal=false: an interaction/async error of an ALREADY-RENDERED report — log it, but never
        // regenerate (or overwrite) a working report over it.
        if (msg.fatal === false) {
          showAdHocDebugLog('sandbox', 'non-fatal error in a rendered report (ignored)', msg.message);
          return;
        }
        if (timerRef.current) clearTimeout(timerRef.current);
        onErrorRef.current(msg.message || 'The report code threw an error.');
      }
    };
    window.addEventListener('message', handler);
    return () => {
      window.removeEventListener('message', handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [postRender, handleFrameEvent]);

  // (Re)render whenever the code or data changes and the frame is ready.
  useEffect(() => {
    postRender();
  }, [postRender]);

  const frameProps = useMemo(
    () =>
      srcDoc == null
        ? null
        : {
            ref,
            sandbox: 'allow-scripts',
            srcDoc,
            onLoad: handleLoad,
            title: 'Ad-hoc report',
            style: {
              width: '100%',
              height,
              border: '1px solid #e0e0e0',
              borderRadius: 4,
              background: '#fff',
            } as React.CSSProperties,
          },
    [handleLoad, height, srcDoc]
  );

  return { frameProps };
}
