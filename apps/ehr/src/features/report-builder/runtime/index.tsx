// Iframe runtime bundle entry point. Everything the report needs (React, MUI + DataGridPro, ECharts,
// Vega-Lite, the Report components, the JSX transpiler) lives in this bundle — the frame has no
// network and loads nothing else. Once ready, the SPA posts { type: 'render', code, … } with either a
// dataset's rows + schema (the runtime-scope catalog's contract) or a fetch plan's resources + run
// params (the plan report scope: the resources and the data map's helpers); the code is the JSX BODY
// of that function (the same contract the generation prompt shows the model), exactly as generated.
// The runtime transpiles it here.
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { LicenseInfo } from '@mui/x-data-grid-pro';
import React, { useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';
import type { AdHocRow, LlmDatasetSchema } from 'utils/lib/types/adhoc/datasets/llm-schema';
// Deep imports: keep the whole utils barrel (and zod) out of the iframe bundle.
import {
  RUNTIME_SCOPE_PARAM_NAMES,
  RuntimeScopeParamName,
} from 'utils/lib/types/adhoc/generation/runtime-scope.catalog';
import { transpileReportJsx } from 'utils/lib/types/adhoc/generation/transpile';
import {
  PLAN_REPORT_SCOPE_PARAMS,
  PlanReportParams,
  PlanReportResources,
} from 'utils/lib/types/adhoc/plan/report-scope';
import { helpers } from 'utils/lib/types/adhoc/runtime/helpers';
import { describeReportError, renderReportCode } from './compile';
import { ErrorBoundary } from './ErrorBoundary';
import { measureHeight, sendLifecycle } from './messaging';
import { MUI, Report } from './scope';

interface RenderMessage {
  type: 'render';
  code: string;
  // A dataset report's rows + schema…
  data?: AdHocRow[];
  schema?: LlmDatasetSchema;
  // …or a plan report's resources + run params (the plan report scope).
  resources?: PlanReportResources;
  params?: PlanReportParams;
  muiLicenseKey?: string;
}

const theme = createTheme({
  palette: { primary: { main: '#0f347c' } },
  typography: { fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' },
});

// The values behind the injected parameter names. Exhaustive by type: a parameter added to the
// catalog fails to compile here until the runtime supplies it, and the ORDER is the catalog's.
function scopeValues(
  data: AdHocRow[] | undefined,
  schema: LlmDatasetSchema | undefined
): Record<RuntimeScopeParamName, unknown> {
  return { React, MUI, Report, data: data ?? [], schema: schema ?? {} };
}

// The plan report scope: the fetched resources and the data map's helpers instead of rows.
function planScopeValues(
  resources: PlanReportResources,
  params: PlanReportParams | undefined
): Record<(typeof PLAN_REPORT_SCOPE_PARAMS)[number], unknown> {
  return {
    React,
    MUI,
    Report,
    resources,
    helpers,
    params: params ?? { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, totals: {} },
  };
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

  // Forward errors thrown outside React's render pass (handlers, timers). Before the first clean
  // render they're generation failures (fatal → auto-repair); after, interaction errors of a working
  // report (fatal=false → log only). ResizeObserver "loop" warnings are browser noise.
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
      const paramNames: readonly string[] = msg.resources ? PLAN_REPORT_SCOPE_PARAMS : RUNTIME_SCOPE_PARAM_NAMES;
      const scope: Record<string, unknown> = msg.resources
        ? planScopeValues(msg.resources, msg.params)
        : scopeValues(msg.data, msg.schema);
      const element = renderReportCode(transpiled.code, paramNames, scope);

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
