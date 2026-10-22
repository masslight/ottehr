import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SystemReport } from 'src/features/system-reports/SystemReport';
import type { SystemReport as SystemReportDefinition } from 'utils/lib/types/adhoc/system/system-report';
import { RoleType } from 'utils/lib/types/api/user.types';
import { describe, expect, it, vi } from 'vitest';

const runSystemReport = vi.hoisted(() => vi.fn());
vi.mock('src/api/api', () => ({ runSystemReport, getAdHocReportStatus: vi.fn(), listSystemReports: vi.fn() }));
// One stable client object, as the real hook returns: a new object per render would refetch in a loop.
const oystehrZambda = vi.hoisted(() => ({}));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda }) }));

// No plan: nothing is fetched; the code renders from the host's inputs alone.
const report: SystemReportDefinition = {
  id: 'r1',
  name: 'greeting',
  title: 'Greeting',
  parameters: [],
  roles: [RoleType.Provider],
  inputs: [
    { name: 'patientId', kind: 'id', required: true },
    { name: 'visits', kind: 'number', required: false },
  ],
  code: `function ReportRoot() {
  return <Report.Section title="Inputs">
    <MUI.Typography data-testid="patient">{params.inputs.patientId}</MUI.Typography>
    <MUI.Typography data-testid="steps">{Object.keys(resources).length}</MUI.Typography>
  </Report.Section>;
}
return ReportRoot;`,
  runtimeVersion: 1,
};

const withRange: SystemReportDefinition = {
  ...report,
  inputs: [
    ...(report.inputs ?? []),
    { name: 'range', kind: 'dateRange', required: false, default: { preset: 'last-7-days' } },
  ],
  code: `function ReportRoot() {
  return <MUI.Typography data-testid="range">{params.inputs.range.start === params.dateRange.start ? 'same' : 'differs'}</MUI.Typography>;
}
return ReportRoot;`,
};

const renderReport = (
  inputs: Record<string, unknown>,
  opts: { inPlace?: boolean; report?: SystemReportDefinition } = {}
): ReturnType<typeof render> =>
  render(
    <MemoryRouter>
      <SystemReport report={opts.report ?? report} inputs={inputs} inPlace={opts.inPlace} />
    </MemoryRouter>
  );

describe('SystemReport', () => {
  it('renders a report without a plan from its inputs, without calling the run zambda', async () => {
    renderReport({ patientId: 'p1', visits: 3 });
    await waitFor(() => expect(screen.getByTestId('patient')).toHaveTextContent('p1'));
    expect(screen.getByTestId('steps')).toHaveTextContent('0');
    expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument();
    // no dateRange input declared: no picker
    expect(screen.queryByLabelText('Date Range')).toBeNull();
    expect(runSystemReport).not.toHaveBeenCalled();
  });

  it('shows the date picker on its default for a declared dateRange input, and fills params.dateRange from it', async () => {
    renderReport({ patientId: 'p1' }, { report: withRange });
    await waitFor(() => expect(screen.getByTestId('range')).toHaveTextContent('same'));
    expect(screen.getByLabelText('Date Range')).toHaveTextContent('Last 7 Days');
  });

  it('shows no picker when the host passes the dateRange input', async () => {
    renderReport(
      { patientId: 'p1', range: { start: '2026-01-01T05:00:00.000Z', end: '2026-01-31T04:59:59.999Z' } },
      { report: withRange }
    );
    await waitFor(() => expect(screen.getByTestId('range')).toHaveTextContent('same'));
    expect(screen.queryByLabelText('Date Range')).toBeNull();
  });

  it('in a place, runs with the Run button and description hidden', async () => {
    renderReport({ patientId: 'p2' }, { inPlace: true });
    await waitFor(() => expect(screen.getByTestId('patient')).toHaveTextContent('p2'));
    expect(screen.queryByRole('button', { name: 'Run' })).toBeNull();
  });

  it('shows an error instead of running when a required input is missing or of the wrong kind', async () => {
    renderReport({ visits: 'three' });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('input "patientId" is required');
    expect(screen.getByRole('alert')).toHaveTextContent('input "visits" must be a number');
    expect(screen.queryByTestId('patient')).toBeNull();
    expect(runSystemReport).not.toHaveBeenCalled();
  });
});
