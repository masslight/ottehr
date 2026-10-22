import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SystemReportTab, SystemReportTabs } from 'src/features/system-reports/SystemReportTabs';
import type { SystemReport as SystemReportDefinition } from 'utils/lib/types/adhoc/system/system-report';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSystemReport = vi.hoisted(() => vi.fn());
vi.mock('src/api/api', () => ({ getSystemReport, runSystemReport: vi.fn(), getAdHocReportStatus: vi.fn() }));
// One stable client object, as the real hook returns: a new object per render would refetch in a loop.
const oystehrZambda = vi.hoisted(() => ({}));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda }) }));

const report = (name: string, extra: Partial<SystemReportDefinition> = {}): SystemReportDefinition => ({
  id: `id-${name}`,
  name,
  title: name,
  parameters: [],
  inputs: [{ name: 'patientId', kind: 'id', required: true }],
  code: `function ReportRoot() { return <MUI.Typography data-testid="report-${name}">${name} for {params.inputs.patientId}</MUI.Typography>; }\nreturn ReportRoot;`,
  runtimeVersion: 1,
  ...extra,
});

const published: Record<string, SystemReportDefinition> = {
  'vitals-flowsheet': report('vitals-flowsheet'),
  'growth-charts': report('growth-charts'),
  units: report('units', {
    code: `function ReportRoot() { return <MUI.Typography data-testid="units">{params.inputs.units} {params.inputs.visitDate}</MUI.Typography>; }\nreturn ReportRoot;`,
  }),
};

const renderTabs = (
  reports: SystemReportTab[],
  inputs: Record<string, unknown> = { patientId: 'p1' }
): ReturnType<typeof render> =>
  render(
    <MemoryRouter>
      <SystemReportTabs pageTab="Enter vitals" reports={reports} inputs={inputs}>
        <div data-testid="page">the vitals form</div>
      </SystemReportTabs>
    </MemoryRouter>
  );

describe('SystemReportTabs', () => {
  beforeEach(() => {
    getSystemReport.mockReset();
    getSystemReport.mockImplementation(async (_client: unknown, { name }: { name: string }) => {
      const found = published[name];
      if (!found) throw new Error(`No system report named "${name}"`);
      return { report: found };
    });
  });

  it('shows the page tab then one tab per named report, and loads and renders a report when its tab is opened', async () => {
    renderTabs([
      { name: 'vitals-flowsheet', label: 'Vitals flowsheet' },
      { name: 'growth-charts', label: 'Growth charts' },
    ]);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Enter vitals',
      'Vitals flowsheet',
      'Growth charts',
    ]);
    expect(screen.getByTestId('page')).toBeVisible();
    expect(getSystemReport).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('tab', { name: 'Growth charts' }));
    await waitFor(() => expect(screen.getByTestId('report-growth-charts')).toHaveTextContent('growth-charts for p1'));
    expect(getSystemReport).toHaveBeenCalledTimes(1);
    expect(getSystemReport).toHaveBeenCalledWith(oystehrZambda, { name: 'growth-charts' });
    expect(screen.getByTestId('page')).not.toBeVisible();
    // back to the page: the report stays mounted, hidden, and is not loaded again
    await userEvent.click(screen.getByRole('tab', { name: 'Enter vitals' }));
    expect(screen.getByTestId('page')).toBeVisible();
    await userEvent.click(screen.getByRole('tab', { name: 'Growth charts' }));
    expect(getSystemReport).toHaveBeenCalledTimes(1);
  });

  it('renders the page alone, with no tab bar, when the screen names no report', () => {
    renderTabs([]);
    expect(screen.getByTestId('page')).toBeVisible();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(getSystemReport).not.toHaveBeenCalled();
  });

  it('shows an error in the tab when the named report is not published', async () => {
    renderTabs([{ name: 'missing', label: 'Missing' }]);
    await userEvent.click(screen.getByRole('tab', { name: 'Missing' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No system report named "missing"'));
  });

  it('hands every host input to the report, the units and visit date among them', async () => {
    renderTabs([{ name: 'units', label: 'Units' }], {
      patientId: 'p1',
      units: 'imperial',
      visitDate: '2026-08-10T13:30:00.000Z',
    });
    await userEvent.click(screen.getByRole('tab', { name: 'Units' }));
    await waitFor(() => expect(screen.getByTestId('units')).toHaveTextContent('imperial 2026-08-10T13:30:00.000Z'));
  });
});
