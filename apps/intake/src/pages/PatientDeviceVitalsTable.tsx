import { Typography } from '@mui/material';
import { DataGridPro, GridColDef, GridPaginationModel } from '@mui/x-data-grid-pro';
import React, { useState } from 'react';

interface VitalsData {
  message: string;
  vitals: Array<{
    valueString?: string;
    valueInteger?: number;
    code: {
      text: string;
    };
  }>;
  total: number;
}

interface DeviceVitalsProps {
  vitalsData?: VitalsData;
  deviceId: string;
  loading?: boolean;
  firstName?: string;
  lastName?: string;
}

export const PatientDeviceVitalsTable: React.FC<DeviceVitalsProps> = ({ vitalsData, loading }) => {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 5,
  });
  const transformVitalsToRows = (): any => {
    if (!vitalsData?.vitals) return [];
    const rowData: Record<string, string | number> = { id: 1 };

    vitalsData.vitals.forEach((vital) => {
      const key = vital.code.text;
      const value = vital.valueInteger !== undefined ? vital.valueInteger : vital.valueString || '';
      rowData[key] = value;
    });
    return [rowData];
  };

  const rows = transformVitalsToRows();

  const generateColumns = (): GridColDef[] => {
    if (!vitalsData?.vitals) return [];
    const columns: GridColDef[] = [];
    vitalsData.vitals.forEach((vital) => {
      const fieldName = vital.code.text;
      if (fieldName.toLowerCase().includes('threshold')) {
        return;
      }
      if (!columns.find((col) => col.field === fieldName)) {
        columns.push({
          field: fieldName,
          headerName: fieldName
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' '),
          width: 150,
          valueFormatter: (params) => {
            const value = params.value;
            if (fieldName === 'Battery') {
              return `${value}%`;
            }
            return value?.toString() || '';
          },
        });
      }
    });

    return columns;
  };

  const columns = generateColumns();

  return (
    <>
      {rows.length > 0 ? (
        <DataGridPro
          rows={rows}
          columns={columns}
          autoHeight
          pagination
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          disableColumnMenu
          disableRowSelectionOnClick
          sx={{
            width: '100%',
            border: 0,
            overflowX: 'auto',
            '.MuiDataGrid-columnHeaderTitle': {
              fontWeight: 500,
              whiteSpace: 'normal',
              lineHeight: 1.2,
            },
            '.MuiDataGrid-cell': {
              whiteSpace: 'normal',
              lineHeight: 1.4,
            },
          }}
        />
      ) : (
        <Typography variant="body1" sx={{ textAlign: 'center', py: 4 }}>
          {loading ? 'Loading vitals data...' : 'No vitals data available'}
        </Typography>
      )}
    </>
  );
};
