import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, Button, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import CustomBreadcrumbs from './CustomBreadcrumbs';

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
  loading?: boolean;
  firstName?: string;
  lastName?: string;
  thresholds?: Threshold[];
  deviceType?: string;
}

export const DeviceVitalsTable: React.FC<DeviceVitalsProps> = ({
  vitalsData,
  loading,
  deviceId,
  thresholds = [],
  deviceType = '',
}) => {
  const navigate = useNavigate();

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

  const transformVitalsToRows = (): any => {
    if (!vitalsData?.vitals) return [];

    const rowData: Record<string, string | number> = { id: 1 };

    vitalsData.vitals.forEach((vital) => {
      const key = vital.code.text.trim();
      const value = vital.valueInteger !== undefined ? vital.valueInteger : vital.valueString || '';
      rowData[key] = value;
    });

    return [rowData];
  };

  const rows = transformVitalsToRows();
  console.log('Transformed rows:', rows);

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
    if (!vitalsData?.vitals) return [];
    const columns: GridColDef[] = [];

    vitalsData.vitals.forEach((vital) => {
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

            console.log(`Rendering cell: ${fieldName}, value: ${value}, exceeding: ${isExceeding}`);

            let displayValue = value?.toString() || '';

            if (fieldName.toLowerCase().includes('battery')) {
              displayValue = `${value}%`;
            } else if (fieldName.toLowerCase().includes('signal')) {
              displayValue = `${value} dB`;
            } else if (fieldName.toLowerCase().includes('systolic') || fieldName.toLowerCase().includes('diastolic')) {
              displayValue = `${value} mmHg`;
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
                children: loading ? (
                  <Skeleton width={150} />
                ) : (
                  <>
                    <Typography component="span" sx={{ fontWeight: 500 }}>
                      {deviceId}
                    </Typography>
                  </>
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
          hideFooter
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
    </Paper>
  );
};
