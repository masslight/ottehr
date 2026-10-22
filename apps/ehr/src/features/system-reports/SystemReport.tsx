// One system report: its inputs (the host's, or the declared defaults; a dateRange input from the shared
// picker when the host passes none) → run through `run-system-report` (skipped when the report has no plan)
// → the report's code rendered in the page over the fetched resources and the inputs. Links in the report
// navigate the EHR; its CSV exports download, as from the sandbox.
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { captureException } from '@sentry/react';
import type { FhirResource } from 'fhir/r4b';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { planNeedsPatient } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { AdHocDateRangeFilter, DateRange } from 'utils/lib/types/adhoc/query/date-range';
import { AdHocFrameEventSchema } from 'utils/lib/types/adhoc/sandbox/events';
import {
  checkSystemReportInputs,
  dateRangeInputOf,
  SystemReport as SystemReportDefinition,
  withSystemReportInputDefaults,
} from 'utils/lib/types/adhoc/system/system-report';
import { useApiClients } from '../../hooks/useAppClients';
import { downloadCsv } from '../report-builder/hooks/frame-events';
import { hrefForOpenLink } from '../report-builder/hooks/links';
import { AdHocDateRangePicker, rangeFromControls } from '../report-builder/page/AdHocDateRangePicker';
import { controlsFromInputs } from '../report-builder/query/plan-inputs';
import { fetchSystemReportData } from './query';
import { SystemReportParams, SystemReportRender } from './SystemReportRender';

type RunState =
  | { status: 'idle' | 'fetching' }
  | { status: 'done'; resources: Record<string, FhirResource[]>; params: SystemReportParams }
  | { status: 'error'; error: string };

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

interface SystemReportProps {
  report: SystemReportDefinition;
  /** What the host screen knows (patient, encounter, …), checked against the report's declared inputs. */
  inputs?: Record<string, unknown>;
  /** In a place (a host screen) the report just runs: no Run button, no description. */
  inPlace?: boolean;
}

export function SystemReport({ report, inputs = {}, inPlace = false }: SystemReportProps): React.ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  // The report's dateRange input: the host's value when it passed one, else the shared picker from the default.
  const rangeInput = dateRangeInputOf(report.inputs);
  const hostRange = rangeInput ? (inputs[rangeInput.name] as DateRange | undefined) : undefined;
  const showPicker = Boolean(rangeInput) && !hostRange;
  const [initialControls] = useState(() => controlsFromInputs(report.inputs));
  const [dateRange, setDateRange] = useState<AdHocDateRangeFilter>(initialControls?.dateRange ?? 'customRange');
  const [customDate, setCustomDate] = useState(initialControls?.customDate ?? '');
  const [customStartDate, setCustomStartDate] = useState(initialControls?.customStartDate ?? '');
  const [customEndDate, setCustomEndDate] = useState(initialControls?.customEndDate ?? '');
  const [run, setRun] = useState<RunState>({ status: 'idle' });
  const [runKey, setRunKey] = useState(0);
  const [renderError, setRenderError] = useState<string>();

  // Report.Link and Report.Table post their events to window.parent — this page, outside an iframe.
  useEffect(() => {
    const handler = (ev: MessageEvent): void => {
      if (ev.source !== window) return;
      const parsed = AdHocFrameEventSchema.safeParse(ev.data);
      if (!parsed.success) return;
      if (parsed.data.event === 'openLink') {
        const href = hrefForOpenLink(parsed.data.options);
        if (href) navigate(href);
      } else if (parsed.data.event === 'exportData') {
        downloadCsv(parsed.data.filename, parsed.data.csv);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [navigate]);

  const runReport = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) return;
    const range = rangeInput
      ? hostRange ?? rangeFromControls(dateRange, customDate, customStartDate, customEndDate)
      : undefined;
    const resolvedInputs = {
      ...withSystemReportInputDefaults(report.inputs, inputs),
      ...(rangeInput && range ? { [rangeInput.name]: range } : {}),
    };
    const inputErrors = checkSystemReportInputs(report.inputs, resolvedInputs);
    if (inputErrors.length) {
      setRun({ status: 'error', error: `This report cannot run here: ${inputErrors.join('; ')}.` });
      return;
    }
    setRenderError(undefined);
    setRun({ status: 'fetching' });
    try {
      // Inputs reach the server only as the plan's {{patientId}} and the date range; the rest stay in the browser.
      const patientId = typeof resolvedInputs.patientId === 'string' ? resolvedInputs.patientId : undefined;
      const parameters = report.plan && planNeedsPatient(report.plan) && patientId ? { patientId } : undefined;
      const fetched = report.plan
        ? await fetchSystemReportData(oystehrZambda, { reportId: report.id, dateRange: range, parameters })
        : { resources: {}, stats: [] };
      setRunKey((k) => k + 1);
      setRun({
        status: 'done',
        resources: fetched.resources,
        params: {
          dateRange: range,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          patientId,
          totals: Object.fromEntries(fetched.stats.flatMap((s) => (s.total === undefined ? [] : [[s.id, s.total]]))),
          inputs: resolvedInputs,
        },
      });
      const failed = fetched.stats.filter((s) => s.error);
      if (failed.length) setRenderError(`Some data could not be fetched: ${failed.map((s) => s.error).join('; ')}`);
    } catch (e) {
      captureException(e);
      setRun({ status: 'error', error: errorMessage(e) });
    }
  }, [oystehrZambda, report, inputs, rangeInput, hostRange, dateRange, customDate, customStartDate, customEndDate]);

  // The report runs over its inputs as soon as it opens.
  const [autoRan, setAutoRan] = useState(false);
  useEffect(() => {
    if (!oystehrZambda || autoRan) return;
    setAutoRan(true);
    void runReport();
  }, [oystehrZambda, autoRan, runReport]);

  const loading = run.status === 'fetching';

  return (
    <Box>
      {report.description && !inPlace && (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {report.description}
        </Typography>
      )}
      {(showPicker || !inPlace) && (
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          {showPicker && (
            <AdHocDateRangePicker
              dateRange={dateRange}
              customDate={customDate}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              setDateRange={setDateRange}
              setCustomDate={setCustomDate}
              setCustomStartDate={setCustomStartDate}
              setCustomEndDate={setCustomEndDate}
            />
          )}
          {!inPlace && (
            <Button variant="contained" onClick={() => void runReport()} disabled={loading}>
              {loading ? <CircularProgress size={20} /> : 'Run'}
            </Button>
          )}
        </Box>
      )}
      {loading && inPlace && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {run.status === 'error' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {run.error}
        </Alert>
      )}
      {renderError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {renderError}
        </Alert>
      )}
      {run.status === 'done' && (
        <SystemReportRender
          code={report.code}
          resources={run.resources}
          params={run.params}
          runKey={runKey}
          onError={setRenderError}
        />
      )}
    </Box>
  );
}
