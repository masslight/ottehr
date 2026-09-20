import { fireEvent, render, screen } from '@testing-library/react';
import { DateTime } from 'luxon';
import { describe, expect, it, vi } from 'vitest';
import { ReportStatusBar, sameWindow, windowParamsOf } from '../../src/components/ReportStatusBar';

const idleStatus = { state: 'idle' as const, lastCompletedAt: '2026-02-01T09:00:00.000Z' };

const entry = (
  dateFrom: string,
  dateTo: string,
  generatedAt: string
): {
  params: Record<string, unknown>;
  generatedAt: string;
  sizeBytes: number;
} => ({ params: { dateFrom, dateTo }, generatedAt, sizeBytes: 2048 });

describe('ReportStatusBar history control', () => {
  it('lists cached runs and views one on click', () => {
    const onView = vi.fn();
    const onOpen = vi.fn();
    render(
      <ReportStatusBar
        status={idleStatus}
        loading={false}
        dateFrom="2026-02-01"
        dateTo="2026-02-28"
        history={{
          entries: [
            entry('2026-02-01', '2026-02-28', '2026-03-01T08:00:00.000Z'),
            entry('2026-01-01', '2026-01-31', '2026-02-01T09:00:00.000Z'),
          ],
          onOpen,
          onView,
          onRun: vi.fn(),
        }}
      />
    );

    fireEvent.click(screen.getByTestId('report-history-button'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Jan 1, 2026 – Jan 31, 2026')).toBeDefined();
    expect(screen.getAllByText(/Generated .*2 KB/)).toHaveLength(2);

    fireEvent.click(screen.getByText('Jan 1, 2026 – Jan 31, 2026'));
    expect(onView).toHaveBeenCalledWith({ dateFrom: '2026-01-01', dateTo: '2026-01-31' });
  });

  it('runs a new report with the default preset range', () => {
    const onRun = vi.fn();
    render(<ReportStatusBar status={undefined} loading={false} history={{ entries: [], onView: vi.fn(), onRun }} />);

    expect(screen.getByText('No report generated yet')).toBeDefined();
    fireEvent.click(screen.getByTestId('report-history-button'));
    expect(screen.getByText('No reports generated yet.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Run report' }));
    expect(onRun).toHaveBeenCalledTimes(1);
    const params = onRun.mock.calls[0][0];
    expect(params.dateFrom).toBe(DateTime.now().minus({ days: 30 }).toISODate());
    expect(params.dateTo).toBe(DateTime.now().toISODate());
  });

  it('hides the range picker for unwindowed kinds and disables Run while running', () => {
    render(
      <ReportStatusBar
        status={{ state: 'running', progress: 'listing customers…' }}
        loading={false}
        history={{ entries: [], onView: vi.fn(), onRun: vi.fn(), windowed: false }}
      />
    );

    fireEvent.click(screen.getByTestId('report-history-button'));
    expect(screen.queryByLabelText('Date Range')).toBeNull();
    expect((screen.getByRole('button', { name: 'Run report' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('window param helpers', () => {
  it('windowParamsOf picks only string date fields', () => {
    expect(windowParamsOf({ dateFrom: '2026-01-01', dateTo: 42, junk: true })).toEqual({ dateFrom: '2026-01-01' });
    expect(windowParamsOf(undefined)).toEqual({});
  });

  it('sameWindow treats missing and empty as equal', () => {
    expect(sameWindow({}, null)).toBe(true);
    expect(sameWindow({ dateFrom: '2026-01-01' }, { dateFrom: '2026-01-01' })).toBe(true);
    expect(sameWindow({ dateFrom: '2026-01-01' }, {})).toBe(false);
  });
});
