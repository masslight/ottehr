import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, Button, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate, useParams } from 'react-router-dom';
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
  deviceId: string | undefined;
  loading?: boolean;
  firstName?: string;
  lastName?: string;
  thresholds?: Threshold[];
  deviceType?: string;
}

export const DeviceVitalsTable: React.FC<DeviceVitalsProps> = ({ thresholds = [], deviceType = '' }) => {
  const [paginationModel, setPaginationModel] = useState({
    pageSize: 5,
    page: 0,
  });
  const navigate = useNavigate();
  const { patientId, deviceId } = useParams<{ patientId: string; deviceId: string | undefined }>();
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
  console.log('Extracted threshold values:', thresholdValues);

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
    console.log(`Checking field: ${fieldNameLower}, value: ${value}, thresholdValues:`, thresholdValues);

    switch (deviceType) {
      case 'scale_gen2_measure':
        if (fieldNameLower.includes('weight') && thresholdValues.weight !== undefined) {
          return value > thresholdValues.weight;
        }
        break;

      case 'bgm_gen1_measure':
        if (fieldNameLower.includes('glucose') && thresholdValues.glucose !== undefined) {
          return value > thresholdValues.glucose;
        }
        break;

      case 'bpm_gen2_measure':
        if (fieldNameLower.includes('systolic') && thresholdValues.systolic !== undefined) {
          return value > thresholdValues.systolic;
        }
        if (fieldNameLower.includes('diastolic') && thresholdValues.diastolic !== undefined) {
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

    allVitals.forEach((vital) => {
      const fieldName = vital.code.text.trim();

      if (fieldName.toLowerCase().includes('threshold')) return;

      if (!columns.find((col) => col.field === fieldName)) {
        columns.push({
          field: fieldName,
          headerName: fieldName,
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

    return columns;
  };

  const columns = generateColumns();
  console.log('Generated columns:', columns);

  const rows = transformVitalsToRows();
  console.log('Transformed rows:', rows);

  console.log('deviceID:', deviceId);

  return (
    <Paper sx={{ padding: 10, width: '100%', marginInline: 'auto' }} component={Stack} spacing={2}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: 5 }}>
          <Typography variant="h3" color="primary.dark" sx={{ flexGrow: 1 }}>
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
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ marginBottom: '10' }}
        >
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
