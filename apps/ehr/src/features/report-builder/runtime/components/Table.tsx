import { Box, Paper } from '@mui/material';
import {
  DataGridPro,
  GridColDef,
  GridRenderCellParams,
  GridToolbarColumnsButton,
  GridToolbarContainer,
  GridToolbarDensitySelector,
  GridToolbarFilterButton,
} from '@mui/x-data-grid-pro';
import React, { useMemo } from 'react';
import type { AdHocLinkRoute } from 'utils';
import { formatValue, ValueFormat } from './format';
import { Link } from './Link';

export interface TableColumn {
  /** Row field to show. */
  field: string;
  /** Header label; defaults to the field name. */
  label?: string;
  /** Value format: integer | number | percent | currency. */
  format?: ValueFormat;
}

export interface TableLink {
  /** The displayed column whose cells become links. */
  field: string;
  /** Where the link goes; the app owns the URL. 'patient' / 'visitNote' / 'trackingBoard'. */
  route: AdHocLinkRoute;
  /** Row field holding the id (e.g. link patientName by patientId). Defaults to the cell's value. */
  idField?: string;
}

export interface TableProps {
  /** The rows to show (plain objects). */
  rows: Record<string, unknown>[];
  /** Columns to show, in order; defaults to every key of the first row. */
  columns?: TableColumn[];
  /** Make columns clickable into the EHR. */
  links?: TableLink[];
  /** Accessible name for the grid. */
  title?: string;
  /** Initial page size (10 / 25 / 50 / 100). */
  pageSize?: number;
  /** Called with the clicked row (e.g. to drive a drill-down). */
  onRowClick?: (row: Record<string, unknown>) => void;
}

// Reserved grid-row key; the underscored name keeps collisions with report fields implausible.
const ROW_ID_KEY = '__adhocRowId';

interface GridRow extends Record<string, unknown> {
  [ROW_ID_KEY]: number;
}

// A full interactive data grid (sort / filter / column picker / pagination) rendered INSIDE the
// sandboxed frame — the SPA never sees the table's DOM. Numeric columns are detected from the row
// values (rows are already typed; no string re-parsing). A `links` entry turns a column's cells
// into whitelisted navigation events via <Link>.
export function Table({ rows, columns, links, title, pageSize = 25, onRowClick }: TableProps): React.ReactElement {
  const linkByField = useMemo(() => {
    const m = new Map<string, TableLink>();
    (links ?? []).forEach((l) => m.set(l.field, l));
    return m;
  }, [links]);

  const { gridColumns, gridRows } = useMemo(() => {
    const fields = columns?.map((c) => c.field) ?? Object.keys(rows[0] ?? {});
    const configByField = new Map((columns ?? []).map((c) => [c.field, c]));
    const isNumeric = (field: string): boolean =>
      rows.some((r) => typeof r[field] === 'number') &&
      rows.every((r) => r[field] == null || typeof r[field] === 'number');

    const gridColumns: GridColDef[] = fields.map((field) => {
      const cfg = configByField.get(field);
      const numeric = isNumeric(field) && !cfg?.format;
      const link = linkByField.get(field);
      return {
        field,
        headerName: cfg?.label ?? field,
        flex: 1,
        minWidth: 130,
        sortable: true,
        type: numeric ? 'number' : 'string',
        ...(numeric ? { headerAlign: 'right' as const, align: 'right' as const } : {}),
        renderCell: (params: GridRenderCellParams) => {
          const raw = params.row[field];
          const display = cfg?.format
            ? formatValue(raw, cfg.format)
            : Array.isArray(raw)
            ? raw.join(', ')
            : raw == null
            ? ''
            : String(raw);
          if (link) {
            // id from idField's value when given (e.g. link patientName by patientId), else this
            // cell's own value. The SPA owns the URL — never the generated code.
            const idValue = link.idField ? params.row[link.idField] : raw;
            const id = idValue == null ? undefined : String(idValue);
            if (link.route === 'trackingBoard') return <Link route="trackingBoard">{display}</Link>;
            return (
              <Link route={link.route} id={id}>
                {display}
              </Link>
            );
          }
          return <span>{display}</span>;
        },
      };
    });

    const gridRows: GridRow[] = rows.map((r, i) => ({ ...r, [ROW_ID_KEY]: i }));
    return { gridColumns, gridRows };
  }, [columns, rows, linkByField]);

  // No CSV export button: downloads need the `allow-downloads` sandbox flag, but the frame's sandbox
  // is strictly `allow-scripts` (security contract). Export could return later as a whitelisted
  // SPA-side event.
  const Toolbar = useMemo(
    () =>
      function ToolbarInner(): React.ReactElement {
        return (
          <GridToolbarContainer>
            <GridToolbarColumnsButton />
            <GridToolbarFilterButton />
            <GridToolbarDensitySelector />
          </GridToolbarContainer>
        );
      },
    []
  );

  return (
    <Box sx={{ mb: 1 }}>
      <Paper variant="outlined" sx={{ width: '100%' }}>
        {/* Known limitation: the filter/columns panels render in a portal inside the frame and can
            be clipped by the frame's height near the bottom of a short report. */}
        <DataGridPro
          aria-label={title}
          autoHeight
          density="compact"
          getRowId={(r) => (r as GridRow)[ROW_ID_KEY]}
          columns={gridColumns}
          rows={gridRows}
          initialState={{ pagination: { paginationModel: { pageSize } } }}
          pagination
          pageSizeOptions={[10, 25, 50, 100]}
          slots={{ toolbar: Toolbar }}
          disableRowSelectionOnClick
          onRowClick={onRowClick ? (params) => onRowClick(params.row as Record<string, unknown>) : undefined}
          sx={{
            '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600 },
            ...(onRowClick ? { '& .MuiDataGrid-row': { cursor: 'pointer' } } : {}),
          }}
        />
      </Paper>
    </Box>
  );
}
