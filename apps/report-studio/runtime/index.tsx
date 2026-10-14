// The studio's iframe runtime. Same isolation model as the EHR's report frame (srcDoc, sandbox
// allow-scripts, CSP with no network, JSON-only postMessage), same Report / MUI components, but the
// injected scope is the redesign's: the FETCHED FHIR RESOURCES plus the data map's helpers, instead
// of dataset rows. It also profiles a render — which fields the code read per resource type and which
// of those are mostly blank — so the studio can trim each fetch step to the fields actually used.
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { LicenseInfo } from '@mui/x-data-grid-pro';
import type { FhirResource } from 'fhir/r4b';
import React, { useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { transpileReportJsx } from 'utils/lib/types/adhoc/generation/transpile';
import { ErrorBoundary } from '../../ehr/src/features/report-builder/runtime/ErrorBoundary';
import { MUI, Report } from '../../ehr/src/features/report-builder/runtime/scope';
import { helpers } from './helpers';
import { createProfiler, RenderProfile } from './profiler';

export const STUDIO_SCOPE_PARAMS = ['React', 'MUI', 'Report', 'resources', 'helpers', 'params'] as const;
export const STUDIO_ROOT_NAME = 'ReportRoot';

interface RenderMessage {
  type: 'render';
  code: string;
  resources: Record<string, FhirResource[]>;
  params: { dateRange?: { start: string; end: string }; timeZone: string; patientId?: string };
  profile?: boolean;
  muiLicenseKey?: string;
}

export type FrameMessage =
  | { type: 'ready' }
  | { type: 'rendered'; height: number; text: string; profile?: RenderProfile }
  | { type: 'resize'; height: number }
  | { type: 'error'; message: string; fatal?: boolean };

const theme = createTheme({
  palette: { primary: { main: '#0f347c' }, secondary: { main: '#2169f5' } },
  typography: { fontFamily: 'Rubik, Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' },
});

const post = (message: FrameMessage): void => {
  try {
    window.parent.postMessage(message, '*');
  } catch {
    // Never crash the frame over a failed postMessage.
  }
};

const measureHeight = (): number => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);

const REPORT_CODE_URL = 'report-code.js';
const MAX_ERROR_LENGTH = 600;
const MAX_TEXT_LENGTH = 6000;
const SNAPSHOT_DELAY_MS = 350;

const WRAP_PREFIX = `(function (${STUDIO_SCOPE_PARAMS.join(', ')}) {\n`;
const WRAP_SUFFIX = '\n})';

type ReportFactory = (...args: unknown[]) => unknown;

function compileReport(body: string): ReportFactory {
  // Indirect eval in global scope: only the wrapper's parameters are in scope for the report code.
  const wrapped = `${WRAP_PREFIX}${body}${WRAP_SUFFIX}\n//# sourceURL=${REPORT_CODE_URL}`;
  return (0, eval)(wrapped) as ReportFactory;
}

function describeReportError(e: unknown): string {
  if (!(e instanceof Error)) return String(e).slice(0, MAX_ERROR_LENGTH);
  const match = typeof e.stack === 'string' ? e.stack.match(/report-code\.js:(\d+):\d+/) : null;
  const line = match ? Number(match[1]) - 1 : null;
  const base = e.message ? `${e.name}: ${e.message}` : e.name;
  return (line && line >= 1 ? `${base} (around line ${line} of your code)` : base).slice(0, MAX_ERROR_LENGTH);
}

function toElement(returned: unknown, scope: Record<string, unknown>): React.ReactElement {
  if (typeof returned === 'function') {
    return React.createElement(returned as React.ComponentType<Record<string, unknown>>, { ...scope });
  }
  if (React.isValidElement(returned)) return returned;
  throw new Error(`the report code must return a React component, e.g. \`return ${STUDIO_ROOT_NAME};\``);
}

function RenderedSignal({
  children,
  onRendered,
}: {
  children: React.ReactNode;
  onRendered: () => void;
}): React.ReactElement {
  useEffect(() => {
    onRendered();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

/** What the rendered report says, for the model to read back: visible text plus a structural count. */
function snapshotText(container: HTMLElement): string {
  const grids = container.querySelectorAll('[role="grid"], [role="treegrid"]').length;
  const charts = container.querySelectorAll('canvas, svg.marks').length;
  const text = (container.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
  const head = `[rendered: ${grids} table(s), ${charts} chart(s), ${text.length} chars of text]\n`;
  return head + (text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH)}\n…[truncated]` : text);
}

function start(): void {
  const container = document.getElementById('root') ?? document.body.appendChild(document.createElement('div'));
  let root: Root | null = null;
  let renderSeq = 0;
  let hasRendered = false;

  let lastHeight = 0;
  const reportResize = (): void => {
    const height = measureHeight();
    if (height !== lastHeight) {
      lastHeight = height;
      post({ type: 'resize', height });
    }
  };
  try {
    new ResizeObserver(reportResize).observe(document.body);
  } catch {
    // Height updates degrade gracefully without ResizeObserver.
  }

  window.addEventListener('error', (ev) => {
    const message = ev?.message || '';
    if (/ResizeObserver loop/i.test(message)) return;
    const described =
      ev.error instanceof Error ? describeReportError(ev.error) : message || 'Unknown error in the report frame.';
    post({ type: 'error', message: described, fatal: !hasRendered });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    post({ type: 'error', message: describeReportError(ev.reason), fatal: !hasRendered });
  });

  window.addEventListener('message', (ev: MessageEvent) => {
    const msg = ev.data as RenderMessage | undefined;
    if (!msg || msg.type !== 'render' || typeof msg.code !== 'string') return;

    try {
      if (msg.muiLicenseKey) LicenseInfo.setLicenseKey(msg.muiLicenseKey);

      // The transpiler's own wrapper only makes a top-level `return` legal; it is sliced back off, so
      // the EHR's parameter names never reach this frame's scope.
      const transpiled = transpileReportJsx(msg.code);
      if ('error' in transpiled) {
        post({ type: 'error', message: `the report code did not transpile (${transpiled.error})` });
        return;
      }

      const profiler = createProfiler(msg.resources ?? {}, msg.profile !== false);
      const scope: Record<string, unknown> = {
        React,
        MUI,
        Report,
        resources: profiler.resources,
        helpers,
        params: msg.params ?? { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      };
      const factory = compileReport(transpiled.code);
      const returned: unknown = factory(...STUDIO_SCOPE_PARAMS.map((name) => scope[name]));
      const element = toElement(returned, scope);

      renderSeq += 1;
      hasRendered = false;
      root ??= createRoot(container);
      root.render(
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <ErrorBoundary
            key={renderSeq}
            onError={(error) => post({ type: 'error', message: describeReportError(error) })}
          >
            <RenderedSignal
              key={`s${renderSeq}`}
              onRendered={() => {
                if (container.childElementCount === 0 && !(container.textContent || '').trim()) {
                  post({ type: 'error', message: 'the report rendered nothing' });
                  return;
                }
                hasRendered = true;
                // The data grid and the charts lay out after their own resize observers fire; a short wait
                // makes the text snapshot (what Claude reads back) show the rows and chart labels.
                const seq = renderSeq;
                setTimeout(() => {
                  if (seq !== renderSeq) return;
                  post({
                    type: 'rendered',
                    height: measureHeight(),
                    text: snapshotText(container),
                    profile: msg.profile === false ? undefined : profiler.result(),
                  });
                }, SNAPSHOT_DELAY_MS);
              }}
            >
              {element}
            </RenderedSignal>
          </ErrorBoundary>
        </ThemeProvider>
      );
    } catch (e) {
      post({ type: 'error', message: describeReportError(e) });
    }
  });

  post({ type: 'ready' });
}

start();
