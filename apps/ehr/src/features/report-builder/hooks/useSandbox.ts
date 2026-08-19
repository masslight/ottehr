// SPA side of the report sandbox. Security invariants:
//   - sandbox="allow-scripts" only: opaque origin (no app DOM/cookies/storage/token), no allow-popups.
//   - srcDoc, not a served URL; generated code arrives via postMessage, never in the HTML.
//   - CSP default-src 'none', connect-src 'none' — no network egress.
//   - only JSON crosses the boundary; events are validated against AdHocFrameEventSchema.
import { captureException } from '@sentry/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdHocRow, LlmDatasetSchema } from 'utils/lib/types/adhoc/datasets/llm-schema';
import { AdHocFrameEventSchema } from 'utils/lib/types/adhoc/sandbox/events';
import { showAdHocDebugLog } from '../debug';
import { hrefForOpenLink } from './links';

const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data:',
  "connect-src 'none'",
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

function loadSrcDoc(): Promise<string> {
  return (srcDocPromise ??= import('virtual:adhoc-report-runtime').then((m) => buildSrcDoc(m.default)));
}

const TIMEOUT_MS = 10000;
const MIN_HEIGHT = 160;
const MAX_HEIGHT = 4000;

export const SANDBOX_TIMEOUT_MESSAGE = 'Report timed out — the generated code may be too slow or stuck.';

const MUI_X_LICENSE_KEY: string | undefined = import.meta.env.VITE_APP_MUI_X_LICENSE_KEY;

export interface UseSandboxOptions {
  code: string;
  data: AdHocRow[];
  schema: LlmDatasetSchema;
  onError: (message: string) => void;
  onRendered?: () => void;
}

export interface UseSandbox {
  frameProps: {
    ref: React.RefObject<HTMLIFrameElement>;
    sandbox: string;
    srcDoc: string;
    onLoad: () => void;
    style: React.CSSProperties;
    title: string;
  } | null;
  rendering: boolean;
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
  const [rendering, setRendering] = useState(false);
  const [srcDoc, setSrcDoc] = useState<string | null>(null);

  const handleLoad = useCallback((): void => {
    loadCountRef.current += 1;
    if (loadCountRef.current > 1 && !tornDownRef.current) {
      tornDownRef.current = true;
      const frame = ref.current;
      if (frame) frame.srcdoc = '<!DOCTYPE html><html><body></body></html>';
      console.error('[AdHocReport] report frame attempted to navigate away — blanked for safety');
      captureException(new Error('Ad-hoc report frame attempted to navigate away — blanked for safety'));
      onErrorRef.current('The report was stopped because it attempted to navigate away from the page.');
    }
  }, []);

  const postRender = useCallback(() => {
    const win = ref.current?.contentWindow;
    if (!readyRef.current || !win) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onErrorRef.current(SANDBOX_TIMEOUT_MESSAGE), TIMEOUT_MS);
    setRendering(true);
    win.postMessage({ type: 'render', code, data, schema, muiLicenseKey: MUI_X_LICENSE_KEY }, '*');
  }, [code, data, schema]);

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
    } else if (event.event === 'exportData') {
      const url = URL.createObjectURL(new Blob([event.csv], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = event.filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void loadSrcDoc()
      .then((doc) => {
        if (alive) setSrcDoc(doc);
      })
      .catch((e) => {
        console.error('[AdHocReport] failed to load the report runtime bundle', e);
        captureException(e);
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
        setRendering(false);
        if (typeof msg.height === 'number') setHeight(Math.min(Math.max(msg.height + 24, MIN_HEIGHT), MAX_HEIGHT));
        onRenderedRef.current?.();
      } else if (msg.type === 'resize') {
        if (typeof msg.height === 'number') setHeight(Math.min(Math.max(msg.height + 24, MIN_HEIGHT), MAX_HEIGHT));
      } else if (msg.type === 'error') {
        if (msg.fatal === false) {
          showAdHocDebugLog('sandbox', 'non-fatal error in a rendered report (ignored)', msg.message);
          return;
        }
        if (timerRef.current) clearTimeout(timerRef.current);
        setRendering(false);
        const errorMessage = msg.message || 'The report code threw an error.';
        onErrorRef.current(errorMessage);
        captureException(new Error(errorMessage));
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

  return { frameProps, rendering };
}
