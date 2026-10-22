import { render, screen } from '@testing-library/react';
import { Table } from 'src/features/report-builder/runtime/components/Table';
import { describe, expect, it } from 'vitest';

const rows = Array.from({ length: 30 }, (_, i) => ({ measure: `m${i}`, value: i }));

describe('Report.Table options', () => {
  it('shows the toolbar and paging by default', () => {
    render(<Table rows={rows} columns={[{ field: 'measure' }, { field: 'value' }]} />);
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
    expect(screen.getByText(/1–25 of 30/)).toBeInTheDocument();
  });

  it('can hide the toolbar and paging, pin a column and size columns', () => {
    const { container } = render(
      <Table
        rows={rows}
        columns={[
          { field: 'measure', label: 'Measure', width: 210 },
          { field: 'value', minWidth: 150 },
        ]}
        pinned={['measure']}
        toolbar={false}
        pagination={false}
      />
    );
    expect(screen.queryByText('Export CSV')).toBeNull();
    expect(screen.queryByText(/of 30/)).toBeNull();
    expect(container.querySelector('.MuiDataGrid-pinnedColumnHeaders--left')).not.toBeNull();
    const measureHeader = container.querySelector('[data-field="measure"]') as HTMLElement;
    expect(measureHeader.style.width).toBe('210px');
  });

  it('renders a cell built as an element as it is', () => {
    render(
      <Table
        rows={[{ measure: 'Weight', value: <span data-testid="flag">⚠ 72</span> }]}
        toolbar={false}
        pagination={false}
      />
    );
    expect(screen.getByTestId('flag')).toHaveTextContent('⚠ 72');
  });
});
