import { Typography } from '@mui/material';
import { DataGridPro, GridColDef, GridPaginationModel } from '@mui/x-data-grid-pro';
import moment from 'moment-timezone';
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

  const vitalNameMap: Record<string, string> = {
    data_type: 'Data Type',
    imei: 'IMEI',
    sn: 'Serial Number',
    iccid: 'ICCID',
    uid: 'User Id',
    sys: 'Systolic',
    dia: 'Diastolic',
    pul: 'Pulse',
    inh: 'Irregular Heartbeat',
    hand: 'Hand Tremor',
    wet: 'Weight Stable Time',
    wt: 'Weight',
    tri: 'Three measure flag',
    sig: 'Signal',
    data: 'Blood Glucose',
    bat: 'Battery',
    ts: 'Date/Time',
    upload_time: 'Upload Time',
    tz: 'Time Zone',
  };

  function formatTimestamp(ts: string | number, tz: string): string {
    if (!ts || !tz) return '-';
    try {
      const parsedTs = Number(ts);
      if (isNaN(parsedTs)) return '-';
      return moment.unix(parsedTs).tz(tz).format('MM/DD/YYYY hh:mm:ss A');
    } catch {
      return '-';
    }
  }

  const generateColumns = (): GridColDef[] => {
    if (!vitalsData?.vitals) return [];
    const columns: GridColDef[] = [];

    columns.push({
      field: 'iccid',
      headerName: vitalNameMap['iccid'],
      width: 180,
    });

    vitalsData.vitals.forEach((vital) => {
      const fieldName = vital.code.text;

      if (fieldName.toLowerCase().includes('threshold')) return;
      if (fieldName === 'iccid' || fieldName === 'ts' || fieldName === 'tz') return;

      if (!columns.find((col) => col.field === fieldName)) {
        columns.push({
          field: fieldName,
          headerName:
            vitalNameMap[fieldName] ||
            fieldName
              .split('_')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ') ||
            '-',
          width: 180,
          valueFormatter: (params) => {
            const value = params.value;

            if (fieldName === 'bat' || fieldName === 'Battery') {
              return value !== undefined ? `${value}%` : '-';
            }
            if (value === true) return 'Yes';
            if (value === false) return 'No';
            return value?.toString() || '-';
          },
        });
      }
    });

    columns.push({
      field: 'formattedTime',
      headerName: 'Date/Time',
      width: 200,
      valueGetter: (params) => {
        const ts = params.row['ts'];
        const tz = params.row['tz'];
        return ts && tz ? formatTimestamp(ts, tz) : '-';
      },
    });

    return columns;
  };

  const columns = generateColumns();
  const rows = transformVitalsToRows();

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
