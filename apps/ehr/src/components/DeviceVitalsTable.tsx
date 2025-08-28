import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, Button, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import moment from 'moment-timezone';
import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { getVitals } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import CustomBreadcrumbs from './CustomBreadcrumbs';

interface VitalsData {
  message: string;
  observations: Array<{
    id: string;
    code: string;
    status: string;
    effectiveDateTime?: string;
    components: Array<{
      code: { text: string };
      valueString?: string;
      valueInteger?: number;
    }>;
  }>;
  total: number;
}

interface Threshold {
  type: {
    text: string;
  };
  valueCode: Array<{
    text: string;
  }>;
}

interface DeviceVitalsProps {
  vitalsData?: VitalsData;
  deviceId: string;
  patientId: string;
  loading?: boolean;
  firstName?: string;
  lastName?: string;
  thresholds?: Threshold[];
  deviceType?: string;
  onBack?: () => void;
}

export const DeviceVitalsTable: React.FC<DeviceVitalsProps> = ({
  thresholds = [],
  deviceType = '',
  patientId,
  deviceId,
  onBack,
}) => {
  const [paginationModel, setPaginationModel] = useState({
    pageSize: 5,
    page: 0,
  });
  const navigate = useNavigate();
  // const { patientId, deviceId } = useParams<{ patientId: string; deviceId: string | undefined }>();
  const { oystehrZambda } = useApiClients();

  const { data: vitalsData, isLoading } = useQuery(
    ['vitals', patientId, deviceId, paginationModel.page, paginationModel.pageSize],
    () =>
      getVitals(
        {
          deviceId: deviceId!,
          patientId: patientId!,
          page: paginationModel.page + 1,
          pageSize: paginationModel.pageSize,
        },
        oystehrZambda!
      ),
    { keepPreviousData: true }
  );

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
    ts: 'Timestamp',
    upload_time: 'Upload Time',
    tz: 'Time Zone',
  };

  const normalizeTz = (tz: string): string => {
    if (tz.startsWith('UTC')) {
      return tz.replace('UTC', 'Etc/GMT');
    }
    return tz;
  };

  function formatTimestamp(ts: string | number, tz: string): string {
    if (!ts || !tz) return '-';
    try {
      const parsedTs = Number(ts);
      if (isNaN(parsedTs)) return '-';
      return moment.unix(parsedTs).tz(normalizeTz(tz)).format('MM/DD/YYYY hh:mm:ss A');
    } catch {
      return '-';
    }
  }

  const getThresholdValues = (): Record<string, number> => {
    const thresholdValues: Record<string, number> = {};

    thresholds.forEach((threshold) => {
      const thresholdType = threshold.type.text.toLowerCase();
      const thresholdValue = threshold.valueCode[0]?.text;

      if (thresholdValue) {
        const numericValue = parseInt(thresholdValue);
        if (!isNaN(numericValue)) {
          if (thresholdType.includes('systolic')) {
            thresholdValues.systolic = numericValue;
          } else if (thresholdType.includes('diastolic')) {
            thresholdValues.diastolic = numericValue;
          } else if (thresholdType.includes('glucose')) {
            thresholdValues.glucose = numericValue;
          } else if (thresholdType.includes('weight')) {
            thresholdValues.weight = numericValue;
          } else {
            const genericType = thresholdType.replace(/-threshold$/i, '').trim();
            if (genericType) {
              thresholdValues[genericType] = numericValue;
            }
          }
        }
      }
    });

    return thresholdValues;
  };

  const thresholdValues = getThresholdValues();

  const allVitals =
    vitalsData?.observations?.flatMap((obs) =>
      obs.components.map((comp) => ({
        ...comp,
        observationId: obs.id,
        observationCode: obs.code,
      }))
    ) ?? [];

  const transformVitalsToRows = (): any[] => {
    if (!vitalsData?.observations?.length) return [];

    return vitalsData.observations.map((obs, index) => {
      const rowData: Record<string, string | number> = {
        id: obs.id || index + 1,
      };

      columns.forEach((col) => {
        const comp = obs.components.find((c) => c.code.text.trim() === col.field);
        if (comp) {
          rowData[col.field] = comp.valueInteger !== undefined ? comp.valueInteger : comp.valueString || '-';
        } else {
          rowData[col.field] = '-';
        }
      });

      rowData['iccid'] = obs.components.find((c) => c.code.text === 'iccid')?.valueString ?? '-';
      rowData['ts'] = obs.components.find((c) => c.code.text === 'ts')?.valueInteger ?? '-';
      rowData['tz'] = obs.components.find((c) => c.code.text === 'tz')?.valueString ?? 'UTC';

      return rowData;
    });
  };

  const isValueExceedingThreshold = (fieldName: string, value: any): boolean => {
    if (typeof value !== 'number') {
      const numericValue = typeof value === 'string' ? parseFloat(value) : NaN;
      if (isNaN(numericValue)) return false;
      value = numericValue;
    }

    const fieldNameLower = fieldName.trim().toLowerCase();

    switch (deviceType) {
      case 'WS':
        if (fieldNameLower.includes('wt') && thresholdValues.weight !== undefined) {
          return value > thresholdValues.weight;
        }
        break;

      case 'BG':
        if (fieldNameLower.includes('data') && thresholdValues.glucose !== undefined) {
          return value > thresholdValues.glucose;
        }
        break;

      case 'BP':
        if (fieldNameLower.includes('sys') && thresholdValues.systolic !== undefined) {
          return value > thresholdValues.systolic;
        }
        if (fieldNameLower.includes('dia') && thresholdValues.diastolic !== undefined) {
          return value > thresholdValues.diastolic;
        }
        break;

      default:
        for (const [thresholdKey, thresholdValue] of Object.entries(thresholdValues)) {
          if (fieldNameLower.includes(thresholdKey.toLowerCase())) {
            return value > thresholdValue;
          }
        }
        break;
    }

    return false;
  };

  const generateColumns = (): GridColDef[] => {
    if (!allVitals.length) return [];
    const columns: GridColDef[] = [];

    columns.push({
      field: 'iccid',
      headerName: vitalNameMap['iccid'],
      width: 180,
    });

    allVitals.forEach((vital) => {
      const fieldName = vital.code.text.trim();

      if (fieldName.toLowerCase().includes('threshold')) return;
      if (fieldName === 'iccid' || fieldName === 'ts' || fieldName === 'tz') return;

      if (!columns.find((col) => col.field === fieldName)) {
        columns.push({
          field: fieldName,
          headerName: vitalNameMap[fieldName] || fieldName,
          width: 150,
          renderCell: (params) => {
            const value = params.value;
            const isExceeding = isValueExceedingThreshold(fieldName, value);

            let displayValue: string;

            if (fieldName.toLowerCase().includes('battery')) {
              displayValue = value !== undefined && value !== null ? `${value}` : '-';
            } else if (fieldName.toLowerCase().includes('signal')) {
              displayValue = value !== undefined && value !== null ? `${value}` : '-';
            } else if (fieldName.toLowerCase().includes('systolic') || fieldName.toLowerCase().includes('diastolic')) {
              displayValue = value !== undefined && value !== null ? `${value} ` : '-';
            } else {
              displayValue = value !== undefined && value !== null ? value.toString() : '-';
            }

            return (
              <Typography
                sx={{
                  color: isExceeding ? 'error.main' : 'inherit',
                  fontWeight: isExceeding ? 'bold' : 'normal',
                  fontSize: isExceeding ? '1.1rem' : 'inherit',
                }}
              >
                {displayValue}
              </Typography>
            );
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
    <Paper sx={{ padding: 3 }} component={Stack} spacing={2}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: 5 }}>
          <Typography variant="h4" color="primary.dark" sx={{ flexGrow: 1 }}>
            Device Vitals
          </Typography>
          <CustomBreadcrumbs
            chain={[
              {
                link: '#',
                children: (
                  <span onClick={() => navigate(-1)} style={{ cursor: 'pointer' }}>
                    Devices
                  </span>
                ),
              },
              {
                link: '#',
                children: isLoading ? (
                  <Skeleton width={150} />
                ) : (
                  <Typography component="span" sx={{ fontWeight: 500 }}>
                    {deviceId ?? '-'}
                  </Typography>
                ),
              },
            ]}
          />
        </Box>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ marginBottom: '10' }}>
          Back
        </Button>
      </Box>

      {rows.length > 0 && columns.length > 0 ? (
        <DataGridPro
          rows={rows}
          columns={columns}
          autoHeight
          rowCount={vitalsData?.total ?? 0}
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
          {isLoading ? 'Loading vitals data...' : 'No vitals data available'}
        </Typography>
      )}
    </Paper>
  );
};
