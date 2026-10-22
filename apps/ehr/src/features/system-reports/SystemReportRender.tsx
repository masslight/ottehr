// Renders a system report's code IN THE PAGE: transpiled with the shared transpiler and evaluated over the
// same scope the iframe runtime injects for a plan report (React, MUI, Report, resources, helpers, params),
// no iframe. Only code loaded from a system-report Basic (list-system-reports) is ever handed to this
// component — the builder's generated and saved reports keep the sandbox.
import type { FhirResource } from 'fhir/r4b';
import React, { useEffect, useMemo } from 'react';
import { transpileReportJsx } from 'utils/lib/types/adhoc/generation/transpile';
import { PLAN_REPORT_SCOPE_PARAMS, PlanReportParams } from 'utils/lib/types/adhoc/plan/report-scope';
import { helpers } from 'utils/lib/types/adhoc/runtime/helpers';
import { describeReportError, renderReportCode } from '../report-builder/runtime/compile';
import { ErrorBoundary } from '../report-builder/runtime/ErrorBoundary';
import { MUI, Report } from '../report-builder/runtime/scope';

/** The plan report's run values plus what the host screen handed the report (see SystemReportInputSchema). */
export type SystemReportParams = PlanReportParams & { inputs: Record<string, unknown> };

interface SystemReportRenderProps {
  code: string;
  resources: Record<string, FhirResource[]>;
  params: SystemReportParams;
  /** Changes on every run so a crashed tree is retried rather than left blank. */
  runKey: number;
  onError: (message: string) => void;
}

export function SystemReportRender({
  code,
  resources,
  params,
  runKey,
  onError,
}: SystemReportRenderProps): React.ReactElement | null {
  const built = useMemo((): { element: React.ReactElement } | { error: string } => {
    const transpiled = transpileReportJsx(code);
    if ('error' in transpiled) return { error: `the report code did not transpile (${transpiled.error})` };
    try {
      const scope = { React, MUI, Report, resources, helpers, params };
      return { element: renderReportCode(transpiled.code, PLAN_REPORT_SCOPE_PARAMS, scope) };
    } catch (e) {
      return { error: describeReportError(e) };
    }
  }, [code, resources, params]);

  useEffect(() => {
    if ('error' in built) onError(built.error);
  }, [built, onError]);

  if ('error' in built) return null;
  return (
    <ErrorBoundary key={runKey} onError={(error) => onError(describeReportError(error))}>
      {built.element}
    </ErrorBoundary>
  );
}
