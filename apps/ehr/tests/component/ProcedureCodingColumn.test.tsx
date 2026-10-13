import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import { ProcedureCodingColumn } from '../../src/features/visits/in-person/components/procedures/ProcedureCodingColumn';

describe('procedure coding column', () => {
  afterEach(() => vi.restoreAllMocks());

  it('fits within the chart scroll area and recalculates after scrolling and resizing', async () => {
    let columnTop = 180;
    let chartBottom = 700;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return {
        top: this.dataset.testid === dataTestIds.documentProcedurePage.codingColumn ? columnTop : 100,
        bottom: chartBottom,
      } as DOMRect;
    });
    const onRender = vi.fn();
    render(
      <div data-testid="chart" style={{ overflowY: 'auto' }}>
        <Profiler id="coding-column" onRender={onRender}>
          <ProcedureCodingColumn containerQuery="@container (min-width: 716px)">
            <div style={{ height: 1200 }}>Suggestions, search and long guidance</div>
          </ProcedureCodingColumn>
        </Profiler>
      </div>
    );
    const column = screen.getByTestId(dataTestIds.documentProcedurePage.codingColumn);
    expect(column.style.getPropertyValue('--procedure-coding-max-height')).toBe('504px');
    const commits = onRender.mock.calls.length;
    columnTop = 116;
    fireEvent.scroll(screen.getByTestId('chart'));
    await waitFor(() => expect(column.style.getPropertyValue('--procedure-coding-max-height')).toBe('568px'));
    expect(onRender).toHaveBeenCalledTimes(commits);
    chartBottom = 600;
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(column.style.getPropertyValue('--procedure-coding-max-height')).toBe('468px'));
  });
});
