import { alpha, Box, useTheme } from '@mui/material';
import {
  DataGridPro,
  GridCellParams,
  GridColDef,
  GridFilterItem,
  GridFilterModel,
  GridFilterOperator,
  GridSortDirection,
} from '@mui/x-data-grid-pro';
import { DateTime } from 'luxon';
import { ReactElement } from 'react';

export const dateTimeEqualsOperator: GridFilterOperator = {
  label: 'DTEquals',
  value: 'dtequals',
  getApplyFilterFn: (filterItem: GridFilterItem) => {
    if (!filterItem.field || !filterItem.value || !filterItem.operator) {
      return null;
    }

    return (params: GridCellParams): boolean => {
      return DateTime.fromISO(params.value as string).toISODate() === filterItem.value.toISODate();
    };
  },
  InputComponentProps: { type: DateTime },
};

interface CustomTableProps {
  defaultSort: { field: string; sort: GridSortDirection };
  emptyMessage: string;
  filterModel?: GridFilterModel;
  isLoading: boolean;
  rows: any;
  columns: GridColDef[];
}

export default function CustomTable({
  defaultSort,
  emptyMessage,
  filterModel,
  isLoading,
  rows,
  columns,
}: CustomTableProps): ReactElement {
  const theme = useTheme();

  const emptyTable = (): ReactElement => (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {emptyMessage}
    </Box>
  );

  return (
    <DataGridPro
      autoHeight
      columnHeaderHeight={52}
      disableColumnFilter
      disableColumnMenu
      filterModel={filterModel}
      hideFooterSelectedRowCount
      initialState={{
        pagination: {
          paginationModel: {
            pageSize: 10,
            page: 0,
          },
        },
        sorting: { sortModel: [defaultSort] },
      }}
      loading={isLoading}
      pageSizeOptions={[10]}
      rows={rows ?? []}
      columns={columns.map((column) => ({ ...column, flex: 1 }))}
      slots={{
        noRowsOverlay: emptyTable,
        noResultsOverlay: emptyTable,
      }}
      sx={{
        border: 'none',
        mt: 1.5,
        height: '100%',
        width: '100%',
        '& .MuiDataGrid-columnSeparator': {
          display: 'none',
        },
        '& .MuiDataGrid-row:hover': {
          cursor: 'pointer',
          backgroundColor: alpha(theme.palette.primary.light, 0.08),
        },
        '& .MuiDataGrid-columnHeaderTitle': {
          fontWeight: 'bold',
        },
      }}
    />
  );
}
