import { Box, Link as MuiLink, Paper, Typography } from '@mui/material';
import {
  DataGridPro,
  GridColDef,
  GridRenderCellParams,
  GridToolbarColumnsButton,
  GridToolbarContainer,
  GridToolbarDensitySelector,
  GridToolbarExport,
  GridToolbarFilterButton,
} from '@mui/x-data-grid-pro';
import React, { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ExtractedTable } from './types';

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'ad-hoc-report'
  );
}

// Strip common number formatting ($, %, thousands separators) and parse. Returns null when the text
// isn't a clean number — used both to decide a column is numeric and to provide the sort value.
function toNumber(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const cleaned = t.replace(/[$,%\s]/g, '');
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// A column is numeric only if every non-empty cell parses as a number (and at least one does).
function columnIsNumeric(values: string[]): boolean {
  let sawValue = false;
  for (const v of values) {
    if (v.trim() === '') continue;
    if (toNumber(v) === null) return false;
    sawValue = true;
  }
  return sawValue;
}

interface GridRow {
  id: number;
  [field: string]: unknown;
}

function buildGrid(table: ExtractedTable): { columns: GridColDef[]; rows: GridRow[] } {
  const ncols = table.columns.length;
  const colValues: string[][] = Array.from({ length: ncols }, () => []);
  table.rows.forEach((r) => {
    for (let i = 0; i < ncols; i++) colValues[i].push(r[i]?.text ?? '');
  });
  const numeric = colValues.map(columnIsNumeric);

  const columns: GridColDef[] = table.columns.map((name, i) => {
    const field = `c${i}`;
    const isNum = numeric[i];
    return {
      field,
      headerName: name,
      flex: 1,
      minWidth: 130,
      sortable: true,
      type: isNum ? 'number' : 'string',
      ...(isNum ? { headerAlign: 'right' as const, align: 'right' as const } : {}),
      renderCell: (params: GridRenderCellParams) => {
        const display = params.row[`${field}__text`] as string;
        const href = params.row[`${field}__href`] as string | undefined;
        if (href) {
          return (
            <MuiLink component={RouterLink} to={href} sx={{ textDecoration: 'none' }}>
              {display}
            </MuiLink>
          );
        }
        return <span>{display}</span>;
      },
    };
  });

  const rows: GridRow[] = table.rows.map((r, idx) => {
    const row: GridRow = { id: idx };
    for (let i = 0; i < ncols; i++) {
      const cell = r[i] ?? { text: '' };
      const field = `c${i}`;
      row[`${field}__text`] = cell.text; // what the cell shows
      if (cell.href) row[`${field}__href`] = cell.href;
      // The cell VALUE (used for sort / filter / export) is the number for numeric columns, the text
      // otherwise.
      row[field] = numeric[i] ? toNumber(cell.text) : cell.text;
    }
    return row;
  });

  return { columns, rows };
}

interface AdHocTableGridProps {
  table: ExtractedTable;
  reportTitle?: string;
}

// Renders a table the report produced as a DataGridPro — the same grid the rest of the reports area
// uses — so each column is sortable and filterable and the whole thing is exportable.
export function AdHocTableGrid({ table, reportTitle }: AdHocTableGridProps): React.ReactElement {
  const { columns, rows } = useMemo(() => buildGrid(table), [table]);
  const fileName = slug([reportTitle, table.label].filter(Boolean).join('-'));
  // Don't repeat the report's own title: a single-table report typically gives the table a heading
  // identical to the report title, which the page already shows above the frame.
  const showLabel = !!table.label && slug(table.label) !== slug(reportTitle ?? '');
  const Toolbar = useMemo(
    () =>
      function ToolbarInner(): React.ReactElement {
        return (
          <GridToolbarContainer>
            <GridToolbarColumnsButton />
            <GridToolbarFilterButton />
            <GridToolbarDensitySelector />
            <GridToolbarExport csvOptions={{ fileName }} />
          </GridToolbarContainer>
        );
      },
    [fileName]
  );

  return (
    <Box sx={{ mb: 3 }}>
      {showLabel && (
        <Typography variant="h6" sx={{ mb: 1 }}>
          {table.label}
        </Typography>
      )}
      <Paper variant="outlined" sx={{ width: '100%' }}>
        <DataGridPro
          autoHeight
          density="compact"
          columns={columns}
          rows={rows}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pagination
          pageSizeOptions={[10, 25, 50, 100]}
          slots={{ toolbar: Toolbar }}
          disableRowSelectionOnClick
          sx={{ '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600 } }}
        />
      </Paper>
    </Box>
  );
}
