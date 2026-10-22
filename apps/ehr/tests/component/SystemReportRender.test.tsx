import { render, screen, waitFor } from '@testing-library/react';
import type { Appointment } from 'fhir/r4b';
import { SystemReportRender } from 'src/features/system-reports/SystemReportRender';
import { describe, expect, it, vi } from 'vitest';

const visits: Appointment[] = [
  { resourceType: 'Appointment', id: 'a1', status: 'booked', participant: [] },
  { resourceType: 'Appointment', id: 'a2', status: 'fulfilled', participant: [] },
];

const params = {
  dateRange: { start: '2026-10-01T04:00:00.000Z', end: '2026-10-16T03:59:59.999Z' },
  timeZone: 'America/New_York',
  totals: {},
  inputs: {},
};

// The studio contract: a JSX body over (React, MUI, Report, resources, helpers, params) returning ReportRoot.
const code = `
const idx = helpers.index(resources.visits);
const byStatus = helpers.countBy(idx.byType.Appointment || [], (a) => a.status);
function ReportRoot() {
  return (
    <Report.Section title="Visits by status">
      <Report.Kpi label="Visits" value={(idx.byType.Appointment || []).length} format="integer" />
      <MUI.Typography data-testid="statuses">{Object.keys(byStatus).sort().join(', ')}</MUI.Typography>
      <MUI.Typography data-testid="range">{params.dateRange.start.slice(0, 10)}</MUI.Typography>
    </Report.Section>
  );
}
return ReportRoot;
`;

describe('SystemReportRender', () => {
  it('renders a system report in the page, with no iframe, over the studio scope', () => {
    const onError = vi.fn();
    const { container } = render(
      <SystemReportRender code={code} resources={{ visits }} params={params} runKey={1} onError={onError} />
    );
    expect(screen.getByText('Visits by status')).toBeInTheDocument();
    expect(screen.getByText('Visits')).toBeInTheDocument();
    expect(screen.getByTestId('statuses')).toHaveTextContent('booked, fulfilled');
    expect(screen.getByTestId('range')).toHaveTextContent('2026-10-01');
    expect(container.querySelector('iframe')).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports a transpile error instead of rendering', async () => {
    const onError = vi.fn();
    render(
      <SystemReportRender
        code="function ReportRoot() { return <div>; }"
        resources={{}}
        params={params}
        runKey={1}
        onError={onError}
      />
    );
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError.mock.calls[0][0]).toContain('did not transpile');
  });

  it('reports a crash in the report tree through the error boundary', async () => {
    const onError = vi.fn();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <SystemReportRender
        code={`function ReportRoot() { throw new Error('boom'); }\nreturn ReportRoot;`}
        resources={{}}
        params={params}
        runKey={1}
        onError={onError}
      />
    );
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError.mock.calls[0][0]).toContain('boom');
    spy.mockRestore();
  });
});
