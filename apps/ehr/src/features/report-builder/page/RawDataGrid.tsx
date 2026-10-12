import { Paper } from '@mui/material';
import {
  DataGridPro,
  GridColDef,
  GridColumnVisibilityModel,
  GridToolbarColumnsButton,
  GridToolbarContainer,
  GridToolbarDensitySelector,
  GridToolbarExport,
  GridToolbarFilterButton,
  GridValueFormatterParams,
  GridValueGetterParams,
} from '@mui/x-data-grid-pro';
import React, { useEffect, useMemo, useState } from 'react';
import { AdHocRow, LlmDatasetSchema } from 'utils/lib/types/adhoc/datasets/llm-schema';
import { exactNumberText } from '../runtime/components/format';

const ROW_ID_KEY = '__adhocRawRowId';

interface RawDataGridProps {
  rows: AdHocRow[];
  schema: LlmDatasetSchema;
  loading?: boolean;
  fileName: string;
}

export function rawCellText(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) {
    if (value.some((item) => item !== null && typeof item === 'object')) return JSON.stringify(value);
    return value.map((item) => (item == null ? '' : String(item))).join('; ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const formatNumber = ({ value }: GridValueFormatterParams<number | null | undefined>): string => exactNumberText(value);

export function RawDataGrid({ rows, schema, loading, fileName }: RawDataGridProps): React.ReactElement {
  const { columns, gridRows, extraFields } = useMemo(() => {
    const schemaFields = schema.fields.map((f) => f.name);
    const descriptionByField = new Map(schema.fields.map((f) => [f.name, f.description]));
    const schemaFieldSet = new Set(schemaFields);
    const extras = new Set<string>();
    rows.forEach((r) =>
      Object.keys(r).forEach((key) => {
        if (!schemaFieldSet.has(key) && key !== ROW_ID_KEY) extras.add(key);
      })
    );

    const isNumeric = (field: string): boolean =>
      rows.some((r) => typeof r[field] === 'number') &&
      rows.every((r) => r[field] == null || typeof r[field] === 'number');

    const toColumn = (field: string): GridColDef => {
      const numeric = isNumeric(field);
      return {
        field,
        headerName: field,
        description: descriptionByField.get(field),
        minWidth: 150,
        flex: 1,
        type: numeric ? 'number' : 'string',
        ...(numeric
          ? { valueFormatter: formatNumber }
          : { valueGetter: (params: GridValueGetterParams) => rawCellText(params.row[field]) }),
      };
    };

    const extraFields = [...extras];
    const columns = [...schemaFields, ...extraFields].map(toColumn);
    const gridRows = rows.map((r, i) => ({ ...r, [ROW_ID_KEY]: i }));
    return { columns, gridRows, extraFields };
  }, [rows, schema]);

  const [columnVisibilityModel, setColumnVisibilityModel] = useState<GridColumnVisibilityModel>({});
  useEffect(() => {
    setColumnVisibilityModel((current) => {
      const missing = extraFields.filter((f) => !(f in current));
      if (!missing.length) return current;
      return { ...current, ...Object.fromEntries(missing.map((f) => [f, false])) };
    });
  }, [extraFields]);

  const Toolbar = useMemo(
    () =>
      function RawDataToolbar(): React.ReactElement {
        return (
          <GridToolbarContainer>
            <GridToolbarColumnsButton />
            <GridToolbarFilterButton />
            <GridToolbarDensitySelector />
            <GridToolbarExport
              csvOptions={{ fileName, utf8WithBom: true }}
              printOptions={{ disableToolbarButton: true }}
            />
          </GridToolbarContainer>
        );
      },
    [fileName]
  );

  return (
    <Paper variant="outlined" sx={{ mb: 3, width: '100%' }}>
      <DataGridPro
        aria-label={`${schema.label} raw data`}
        density="compact"
        loading={loading}
        getRowId={(r) => r[ROW_ID_KEY] as number}
        columns={columns}
        rows={gridRows}
        columnVisibilityModel={columnVisibilityModel}
        onColumnVisibilityModelChange={setColumnVisibilityModel}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        pagination
        pageSizeOptions={[25, 50, 100]}
        slots={{ toolbar: Toolbar }}
        disableRowSelectionOnClick
        sx={{ height: 600, '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600 } }}
      />
    </Paper>
  );
}
