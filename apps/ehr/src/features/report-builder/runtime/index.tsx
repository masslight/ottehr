// Iframe runtime bundle entry point. Everything the report needs (React, MUI + DataGridPro, ECharts,
// Vega-Lite, the Report components, the JSX transpiler) lives in this bundle — the frame has no
// network and loads nothing else. Once ready, the SPA posts { type: 'render', code, data, schema };
// the code is the JSX BODY of the function the runtime-scope catalog describes (the same contract
// the generation prompt shows the model), exactly as generated. The runtime transpiles it here.
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { LicenseInfo } from '@mui/x-data-grid-pro';
import React, { useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';
import type { AdHocRow, LlmDatasetSchema } from 'utils';
// Deep imports: keep the whole utils barrel (and zod) out of the iframe bundle.
import {
  REPORT_ROOT_NAME,
  REPORT_WRAP_PREFIX,
  REPORT_WRAP_SUFFIX,
  RUNTIME_SCOPE_PARAM_NAMES,
  RuntimeScopeParamName,
} from 'utils/lib/types/adhoc/generation/runtime-scope.catalog';
import { transpileReportJsx } from 'utils/lib/types/adhoc/generation/transpile';
import { ErrorBoundary } from './ErrorBoundary';
import { measureHeight, sendLifecycle } from './messaging';
import { MUI, Report } from './scope';

interface RenderMessage {
  type: 'render';
  code: string;
  data: AdHocRow[];
  schema: LlmDatasetSchema;
  muiLicenseKey?: string;
}

const theme = createTheme({
  palette: { primary: { main: '#0f347c' } },
  typography: { fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' },
});

// The generated body must `return` a component (preferred) or an element. The injected scope is ALSO
// handed to the root as props: the contract is that it reads `data`/`schema` from the enclosing
// scope, but a model that slips and writes `function ReportRoot({ data })` would otherwise render a
// silently EMPTY report instead of a working one.
function toElement(returned: unknown, scope: Record<RuntimeScopeParamName, unknown>): React.ReactElement {
  if (typeof returned === 'function') {
    return React.createElement(returned as React.ComponentType<Record<string, unknown>>, { ...scope });
  }
  if (React.isValidElement(returned)) return returned;
  throw new Error(`the generated code must return a React component, e.g. \`return ${REPORT_ROOT_NAME};\``);
}

// The generated body runs via indirect eval, wrapped as a named source ("report-code.js"), so a
// thrown error's stack points INTO the report code. sucrase is line-preserving and the wrapper puts
// the body's first line on line 2, so (stack line − REPORT_BODY_LINE_OFFSET) is the line in the
// model's OWN JSX — a precise repair-prompt pointer with no source-map library and no bundle growth.
const REPORT_CODE_URL = 'report-code.js';
const REPORT_BODY_LINE_OFFSET = 1; // line 1 is the wrapper `(function (…) {`; the body starts at line 2
const MAX_ERROR_LENGTH = 600;

type ReportFactory = (...args: unknown[]) => unknown;

function compileReport(body: string): ReportFactory {
  // The wrapper comes from the runtime-scope catalog — the very same one transpileReportJsx slices
  // off — so only the catalog's names are in scope for the generated code. Indirect eval runs in
  // global scope (no app closures leak in), same isolation as new Function; the trailing sourceURL
  // names the script for stack traces.
  const wrapped = `${REPORT_WRAP_PREFIX}${body}${REPORT_WRAP_SUFFIX}\n//# sourceURL=${REPORT_CODE_URL}`;

  return (0, eval)(wrapped) as ReportFactory;
}

// The values behind the injected parameter names. Exhaustive by type: a parameter added to the
// catalog fails to compile here until the runtime supplies it, and the ORDER is the catalog's.
function scopeValues(
  data: AdHocRow[] | undefined,
  schema: LlmDatasetSchema | undefined
): Record<RuntimeScopeParamName, unknown> {
  return { React, MUI, Report, data: data ?? [], schema: schema ?? {} };
}

// Turn a thrown value into a compact, model-actionable string: "Name: message (around line N of
// your code)". Only the derived location is kept — never the raw multi-frame stack (noise, huge).
function describeReportError(e: unknown): string {
  if (!(e instanceof Error)) return String(e).slice(0, MAX_ERROR_LENGTH);
  const match = typeof e.stack === 'string' ? e.stack.match(/report-code\.js:(\d+):\d+/) : null;
  const line = match ? Number(match[1]) - REPORT_BODY_LINE_OFFSET : null;
  const base = e.message ? `${e.name}: ${e.message}` : e.name;
  const located = line && line >= 1 ? `${base} (around line ${line} of your code)` : base;
  return located.slice(0, MAX_ERROR_LENGTH);
}

// Runs the post-commit check after React commits the report tree (children's effects — chart inits
// — run first). The callback decides between "rendered" and a fatal empty-render error.
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

function start(): void {
  const container = document.getElementById('root') ?? document.body.appendChild(document.createElement('div'));
  let root: Root | null = null;
  let renderSeq = 0;
  // True once the CURRENT code rendered cleanly — later errors are interaction/async, not generation
  // failures (fatal=false). Reset on every render message.
  let hasRendered = false;

  // Report height on EVERY content change (drill-downs, pagination, filters grow/shrink the page).
  let lastHeight = 0;
  const reportResize = (): void => {
    const height = measureHeight();
    if (height !== lastHeight) {
      lastHeight = height;
      sendLifecycle({ type: 'resize', height });
    }
  };

  try {
    new ResizeObserver(reportResize).observe(document.body);
  } catch {
    // Height updates degrade gracefully without ResizeObserver.
  }

  // Errors thrown outside React's render pass (event handlers, timers) would otherwise vanish into
  // the frame's console; forward them so the SPA can react. Before the first clean render they are
  // generation failures (fatal → bounded auto-repair); after it, interaction/async errors of a
  // WORKING report (fatal=false → the SPA only logs). ResizeObserver "loop" warnings are browser
  // noise, not report bugs.
  window.addEventListener('error', (ev) => {
    const message = ev?.message || '';
    if (/ResizeObserver loop/i.test(message)) return;
    // ev.error carries the Error (with the report-code.js stack) for uncaught throws; fall back to
    // the bare message string when the browser omits it.
    const described =
      ev.error instanceof Error ? describeReportError(ev.error) : message || 'Unknown error in the report frame.';
    sendLifecycle({ type: 'error', message: described, fatal: !hasRendered });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const reason = (ev as PromiseRejectionEvent).reason;
    sendLifecycle({ type: 'error', message: describeReportError(reason), fatal: !hasRendered });
  });

  window.addEventListener('message', (ev: MessageEvent) => {
    const msg = ev.data as Partial<RenderMessage> | undefined;
    if (!msg || msg.type !== 'render' || typeof msg.code !== 'string') return;

    try {
      // DataGridPro license — passed by the SPA (same key the app uses), set before render.
      if (typeof msg.muiLicenseKey === 'string' && msg.muiLicenseKey) LicenseInfo.setLicenseKey(msg.muiLicenseKey);

      const transpiled = transpileReportJsx(msg.code);

      if ('error' in transpiled) {
        // Syntax/parse failure — the code never ran, so there is no runtime stack to locate.
        sendLifecycle({ type: 'error', message: `the report code did not transpile (${transpiled.error})` });
        return;
      }
      const factory = compileReport(transpiled.code);
      const scope = scopeValues(msg.data, msg.schema);
      const returned: unknown = factory(...RUNTIME_SCOPE_PARAM_NAMES.map((name) => scope[name]));
      const element = toElement(returned, scope);

      renderSeq += 1;
      hasRendered = false;
      root ??= createRoot(container);
      root.render(
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {/* A boundary crash blanks the report — always fatal, even after a first clean render. */}
          <ErrorBoundary
            key={renderSeq}
            onError={(error) => sendLifecycle({ type: 'error', message: describeReportError(error) })}
          >
            <RenderedSignal
              key={`s${renderSeq}`}
              onRendered={() => {
                // The first render over the REAL rows is the validation pass. A component that
                // commits nothing is a broken generation — fatal, so the client's bounded auto-repair
                // regenerates instead of showing a silent blank.
                if (container.childElementCount === 0 && !(container.textContent || '').trim()) {
                  sendLifecycle({ type: 'error', message: 'the generated component rendered nothing' });
                  return;
                }
                hasRendered = true;
                sendLifecycle({ type: 'rendered', height: measureHeight() });
              }}
            >
              {element}
            </RenderedSignal>
          </ErrorBoundary>
        </ThemeProvider>
      );
    } catch (e) {
      sendLifecycle({ type: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  });

  sendLifecycle({ type: 'ready' });
}

start();
