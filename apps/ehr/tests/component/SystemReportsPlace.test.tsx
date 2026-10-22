import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SystemReportsPlace } from 'src/features/system-reports/SystemReportsPlace';
import type { SystemReport as SystemReportDefinition } from 'utils/lib/types/adhoc/system/system-report';
import { RoleType } from 'utils/lib/types/api/user.types';
import { describe, expect, it, vi } from 'vitest';

const listSystemReports = vi.hoisted(() => vi.fn());
vi.mock('src/api/api', () => ({ listSystemReports, runSystemReport: vi.fn(), getAdHocReportStatus: vi.fn() }));
// One stable client object, as the real hook returns: a new object per render would refetch in a loop.
const oystehrZambda = vi.hoisted(() => ({}));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda }) }));

const report = (name: string, extra: Partial<SystemReportDefinition> = {}): SystemReportDefinition => ({
  id: name,
  name,
  title: name,
  parameters: [],
  roles: [RoleType.Provider],
  places: ['visit.vitals'],
  inputs: [{ name: 'patientId', kind: 'id', required: true }],
  code: `function ReportRoot() { return <MUI.Typography data-testid="report-${name}">${name} for {params.inputs.patientId}</MUI.Typography>; }\nreturn ReportRoot;`,
  runtimeVersion: 1,
  ...extra,
});

const renderPlace = (birthDate?: string): ReturnType<typeof render> =>
  render(
    <MemoryRouter>
      <SystemReportsPlace
        place="visit.vitals"
        pageTab="Enter vitals"
        inputs={{ patientId: 'p1' }}
        patient={{ birthDate }}
      >
        <div data-testid="page">the vitals form</div>
      </SystemReportsPlace>
    </MemoryRouter>
  );

describe('SystemReportsPlace', () => {
  it('shows a tab per applicable report after the page tab, and renders a report when its tab is opened', async () => {
    listSystemReports.mockResolvedValue({
      reports: [
        report('Vitals flowsheet'),
        report('Growth charts', { appliesTo: { maxAgeYears: 20 } }),
        report('Elsewhere', { places: [] }),
      ],
    });
    renderPlace('2010-05-01');
    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(3));
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Enter vitals',
      'Vitals flowsheet',
      'Growth charts',
    ]);
    expect(screen.getByTestId('page')).toBeVisible();
    expect(screen.queryByTestId('report-Growth charts')).toBeNull();
    await userEvent.click(screen.getByRole('tab', { name: 'Growth charts' }));
    await waitFor(() => expect(screen.getByTestId('report-Growth charts')).toHaveTextContent('Growth charts for p1'));
    expect(screen.getByTestId('page')).not.toBeVisible();
  });

  it('hides an age-limited report for an adult and for a patient without a birth date', async () => {
    listSystemReports.mockResolvedValue({
      reports: [report('Vitals flowsheet'), report('Growth charts', { appliesTo: { maxAgeYears: 20 } })],
    });
    renderPlace('1996-05-01');
    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(2));
    expect(screen.queryByRole('tab', { name: 'Growth charts' })).toBeNull();
  });

  it('keeps the page tab and the same page node before and after the list loads, with no report tab when none applies', async () => {
    let resolveList: (value: unknown) => void = () => undefined;
    listSystemReports.mockReturnValue(new Promise((resolve) => (resolveList = resolve)));
    renderPlace(undefined);
    const pageBefore = screen.getByTestId('page');
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Enter vitals']);
    resolveList({ reports: [report('Growth charts', { appliesTo: { maxAgeYears: 20 } })] });
    await waitFor(() => expect(listSystemReports).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Enter vitals']);
    expect(screen.getByTestId('page')).toBe(pageBefore);
    expect(pageBefore).toBeVisible();
  });

  it('hands every host input to the report, the units and visit date among them', async () => {
    listSystemReports.mockResolvedValue({
      reports: [
        report('Units', {
          code: `function ReportRoot() { return <MUI.Typography data-testid="units">{params.inputs.units} {params.inputs.visitDate}</MUI.Typography>; }\nreturn ReportRoot;`,
        }),
      ],
    });
    render(
      <MemoryRouter>
        <SystemReportsPlace
          place="visit.vitals"
          pageTab="Enter vitals"
          inputs={{ patientId: 'p1', units: 'imperial', visitDate: '2026-08-10T13:30:00.000Z' }}
          patient={{}}
        >
          <div />
        </SystemReportsPlace>
      </MemoryRouter>
    );
    await userEvent.click(await screen.findByRole('tab', { name: 'Units' }));
    await waitFor(() => expect(screen.getByTestId('units')).toHaveTextContent('imperial 2026-08-10T13:30:00.000Z'));
  });
});
