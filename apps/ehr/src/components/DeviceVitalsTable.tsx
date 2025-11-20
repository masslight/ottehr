import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, Button, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import moment from 'moment-timezone';
import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { getVitals } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';

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

export interface DeviceVitalsProps {
  vitalsData?: VitalsData;
  deviceId: string;
  name: string;
  patientId: string;
  loading?: boolean;
  isModal?: boolean;
  firstName?: string;
  lastName?: string;
  thresholds?: Threshold[];
  deviceType?: string;
  onBack?: () => void;
}

export const DeviceVitalsTable: React.FC<DeviceVitalsProps> = ({
  name,
  isModal,
  deviceType,
  patientId,
  deviceId,
  onBack,
}) => {
  console.log(deviceType);
  const [paginationModel, setPaginationModel] = useState({
    pageSize: isModal ? 5 : 10,
    page: 0,
  });
  const { oystehrZambda } = useApiClients();

  const { data: vitalsData, isLoading } = useQuery(
    ['vitals', patientId, deviceId, paginationModel.page, paginationModel.pageSize, isModal],
    () =>
      getVitals(
        {
          deviceId: deviceId!,
          patientId: patientId!,
          page: paginationModel.page + 1,
          pageSize: paginationModel.pageSize,
          ...(isModal ? { isModal: true } : {}),
        },
        oystehrZambda!
      ),
    { keepPreviousData: true }
  );

  const transformVitalsToRows = (): any[] => {
    if (!vitalsData?.observations?.length) return [];
    return vitalsData.observations;
  };

  const formatDateTime = (dateString: string | null | undefined): string => {
    if (!dateString || dateString === 'null' || dateString === 'undefined') {
      return '-';
    }
    return moment(dateString).isValid() ? moment(dateString).format('L h:mm:ss A') : '-';
  };

  const generateColumns = (): GridColDef[] => {
    let columns: GridColDef[] = [];
    if (deviceType == 'BG') {
      const unitList: any = {
        '1': 'mmol/L',
        '2': 'mg/dL',
      };
      const sampleList: any = {
        '1': 'GOD',
        '2': 'GDH',
      };
      const targetList: any = {
        '1': 'blood or resistanc',
        '2': 'quality control liquid',
        '3': 'sample is invalid',
      };
      const mealList: any = {
        '0': 'not selected',
        '1': 'before meal',
        '2': 'after meal',
      };
      const sigLvlList: any = {
        '0': 'no signal',
        '1': 'poor signal',
        '2': 'fair signal',
        '3': 'good signal',
        '4': 'excellent signal',
      };
      columns = [
        {
          field: 'data',
          headerName: 'Blood glucose',
          width: 180,
          sortable: false,
          renderCell: (params) => {
            const glucoseThreshold = getCmpVal(params.row, 'glucose-threshold');
            const glucoseVariance = getCmpVal(params.row, 'glucose-variance');
            const glucoseCriticalVariance = getCmpVal(params.row, 'glucose-critical-variance');
            const glucose = getCmpVal(params.row, 'data');

            if (glucoseThreshold && glucoseVariance && glucose) {
              const normalRange = getRange(glucoseThreshold, glucoseVariance);

              let isWithinNormal = false;
              let isWithinCritical = false;

              if (normalRange.length === 2) {
                isWithinNormal = !(glucose >= normalRange[0] && glucose <= normalRange[1]);
              }

              if (glucoseCriticalVariance) {
                const criticalRange = getRange(glucoseThreshold, glucoseCriticalVariance);
                if (criticalRange.length === 2) {
                  isWithinCritical = !(glucose >= criticalRange[0] && glucose <= criticalRange[1]);
                }
              }

              let color = 'inherit';
              let fontWeight = 'normal';
              let fontSize = 'inherit';

              if (isWithinCritical) {
                color = 'error.main';
                fontWeight = 'bold';
                fontSize = '1.1rem';
              } else if (isWithinNormal) {
                color = 'warning.main';
                fontWeight = 'bold';
                fontSize = '1.05rem';
              }

              return (
                <Typography
                  sx={{
                    color: color,
                    fontWeight: fontWeight,
                    fontSize: fontSize,
                  }}
                >
                  {glucose}
                </Typography>
              );
            }
            return glucose || '-';
          },
        },
        {
          field: 'unit',
          headerName: 'Unit',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            const _val = getCmpVal(params.row, 'unit') ?? '';
            return unitList?.[_val] || '-';
          },
        },
        {
          field: 'sample',
          headerName: 'Test paper type',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            const _val = getCmpVal(params.row, 'sample') ?? '';
            return sampleList?.[_val] || '-';
          },
        },
        {
          field: 'target',
          headerName: 'Sample type',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            const _val = getCmpVal(params.row, 'target') ?? '';
            return targetList?.[_val] || '-';
          },
        },
        {
          field: 'meal',
          headerName: 'Meal',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            const _val = getCmpVal(params.row, 'meal') ?? '';
            return mealList?.[_val] || '-';
          },
        },
        {
          field: 'sig_lvl',
          headerName: 'Signal',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            const _val = getCmpVal(params.row, 'sig_lvl') ?? '';
            return sigLvlList?.[_val] || '-';
          },
        },
        {
          field: 'effectiveDateTime',
          headerName: 'Date/Time',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            return moment(params.row.effectiveDateTime).isValid()
              ? moment(params.row.effectiveDateTime).format('L h:mm:ss A')
              : '-';
          },
        },
        {
          field: 'issued',
          headerName: 'Upload Time',
          width: 180,
          sortable: false,
          valueGetter: (params) => formatDateTime(params.row.issued),
        },
        {
          field: 'glucoseRange',
          headerName: 'Glucose Warning Range',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            const glucoseThreshold = getCmpVal(params.row, 'glucose-threshold');
            const glucoseVariance = getCmpVal(params.row, 'glucose-variance');
            if (glucoseThreshold && glucoseVariance) {
              return displayRange(getRange(glucoseThreshold, glucoseVariance));
            }
            return '-';
          },
        },
        {
          field: 'glucoseCrticalRange',
          headerName: 'Glucose Critical Range',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            const glucoseThreshold = getCmpVal(params.row, 'glucose-threshold');
            const glucoseVariance = getCmpVal(params.row, 'glucose-critical-variance');
            if (glucoseThreshold && glucoseVariance) {
              return displayRange(getRange(glucoseThreshold, glucoseVariance));
            }
            return '-';
          },
        },
      ];
    } else if (deviceType == 'BP') {
      columns = [
        {
          field: 'sys',
          headerName: 'Systolic',
          width: 180,
          sortable: false,
          renderCell: (params) => {
            const systolicThreshold = getCmpVal(params.row, 'systolic-threshold');
            const systolicVariance = getCmpVal(params.row, 'systolic-variance');
            const systolicCriticalVariance = getCmpVal(params.row, 'systolic-critical-variance');
            const systolic = getCmpVal(params.row, 'sys');

            if (systolicThreshold && systolicVariance && systolic) {
              const normalRange = getRange(systolicThreshold, systolicVariance);

              let isWithinNormal = false;
              let isWithinCritical = false;

              if (normalRange.length === 2) {
                isWithinNormal = !(systolic >= normalRange[0] && systolic <= normalRange[1]);
              }

              if (systolicCriticalVariance) {
                const criticalRange = getRange(systolicThreshold, systolicCriticalVariance);
                if (criticalRange.length === 2) {
                  isWithinCritical = !(systolic >= criticalRange[0] && systolic <= criticalRange[1]);
                }
              }

              let color = 'inherit';
              let fontWeight = 'normal';
              let fontSize = 'inherit';

              if (isWithinCritical) {
                color = 'error.main';
                fontWeight = 'bold';
                fontSize = '1.1rem';
              } else if (isWithinNormal) {
                color = 'warning.main';
                fontWeight = 'bold';
                fontSize = '1.05rem';
              }

              return (
                <Typography
                  sx={{
                    color: color,
                    fontWeight: fontWeight,
                    fontSize: fontSize,
                  }}
                >
                  {systolic}
                </Typography>
              );
            }
            return systolic || '-';
          },
        },
        {
          field: 'dia',
          headerName: 'Diastolic',
          width: 180,
          sortable: false,
          renderCell: (params) => {
            const diastolicThreshold = getCmpVal(params.row, 'diastolic-threshold');
            const diastolicVariance = getCmpVal(params.row, 'diastolic-variance');
            const diastolicCriticalVariance = getCmpVal(params.row, 'diastolic-critical-variance');
            const diastolic = getCmpVal(params.row, 'dia');

            if (diastolicThreshold && diastolicVariance && diastolic) {
              const normalRange = getRange(diastolicThreshold, diastolicVariance);

              let isWithinNormal = false;
              let isWithinCritical = false;

              if (normalRange.length === 2) {
                isWithinNormal = !(diastolic >= normalRange[0] && diastolic <= normalRange[1]);
              }

              if (diastolicCriticalVariance) {
                const criticalRange = getRange(diastolicThreshold, diastolicCriticalVariance);
                if (criticalRange.length === 2) {
                  isWithinCritical = !(diastolic >= criticalRange[0] && diastolic <= criticalRange[1]);
                }
              }

              let color = 'inherit';
              let fontWeight = 'normal';
              let fontSize = 'inherit';

              if (isWithinCritical) {
                color = 'error.main';
                fontWeight = 'bold';
                fontSize = '1.1rem';
              } else if (isWithinNormal) {
                color = 'warning.main';
                fontWeight = 'bold';
                fontSize = '1.05rem';
              }

              return (
                <Typography
                  sx={{
                    color: color,
                    fontWeight: fontWeight,
                    fontSize: fontSize,
                  }}
                >
                  {diastolic}
                </Typography>
              );
            }
            return diastolic || '-';
          },
        },
        {
          field: 'pul',
          headerName: 'Pulse',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            return getCmpVal(params.row, 'pul') || '-';
          },
        },
        {
          field: 'tri',
          headerName: 'Three measure',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            return (getCmpVal(params.row, 'tri') || 'false') === 'true' ? 'Yes' : 'No';
          },
        },
        {
          field: 'sig',
          headerName: 'Signal',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            return getCmpVal(params.row, 'sig') || '-';
          },
        },
        {
          field: 'bat',
          headerName: 'Battery',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            return getCmpVal(params.row, 'bat') || '-';
          },
        },
        {
          field: 'effectiveDateTime',
          headerName: 'Date/Time',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            return moment(params.row.effectiveDateTime).isValid()
              ? moment(params.row.effectiveDateTime).format('L h:mm:ss A')
              : '-';
          },
        },
        {
          field: 'issued',
          headerName: 'Upload Time',
          width: 180,
          sortable: false,
          valueGetter: (params) => formatDateTime(params.row.issued),
        },
        {
          field: 'systolicRange',
          headerName: 'Systolic Warning Range',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            const systolicThreshold = getCmpVal(params.row, 'systolic-threshold');
            const systolicVariance = getCmpVal(params.row, 'systolic-variance');
            if (systolicThreshold && systolicVariance) {
              return displayRange(getRange(systolicThreshold, systolicVariance));
            }
            return '-';
          },
        },
        {
          field: 'diastolicRange',
          headerName: 'Diastolic Warning Range',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            const diastolicThreshold = getCmpVal(params.row, 'diastolic-threshold');
            const diastolicVariance = getCmpVal(params.row, 'diastolic-variance');
            if (diastolicThreshold && diastolicVariance) {
              return displayRange(getRange(diastolicThreshold, diastolicVariance));
            }
            return '-';
          },
        },
        {
          field: 'systolicCriticalRange',
          headerName: 'Systolic Critical Range',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            const systolicThreshold = getCmpVal(params.row, 'systolic-threshold');
            const systolicVariance = getCmpVal(params.row, 'systolic-critical-variance');
            if (systolicThreshold && systolicVariance) {
              return displayRange(getRange(systolicThreshold, systolicVariance));
            }
            return '-';
          },
        },
        {
          field: 'diastolicCriticalRange',
          headerName: 'Diastolic Critical Range',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            const diastolicThreshold = getCmpVal(params.row, 'diastolic-threshold');
            const diastolicVariance = getCmpVal(params.row, 'diastolic-critical-variance');
            if (diastolicThreshold && diastolicVariance) {
              return displayRange(getRange(diastolicThreshold, diastolicVariance));
            }
            return '-';
          },
        },
      ];
    } else if (deviceType == 'WS') {
      columns = [
        {
          field: 'wt',
          headerName: 'Weight',
          width: 180,
          sortable: false,
          renderCell: (params) => {
            const weightThreshold = getCmpVal(params.row, 'weight-threshold');
            const weightVariance = getCmpVal(params.row, 'weight-variance');
            const weightCriticalVariance = getCmpVal(params.row, 'weight-critical-variance');
            const weight = getCmpVal(params.row, 'wt');

            if (weightThreshold && weightVariance && weight) {
              const convertedWeight = weight ? weight * 0.00220462 : '';
              const normalRange = getRange(weightThreshold, weightVariance);

              let isWithinNormal = false;
              let isWithinCritical = false;

              if (normalRange.length === 2) {
                isWithinNormal = !(convertedWeight >= normalRange[0] && convertedWeight <= normalRange[1]);
              }

              if (weightCriticalVariance) {
                const criticalRange = getRange(weightThreshold, weightCriticalVariance);
                if (criticalRange.length === 2) {
                  isWithinCritical = !(convertedWeight >= criticalRange[0] && convertedWeight <= criticalRange[1]);
                }
              }

              let color = 'inherit';
              let fontWeight = 'normal';
              let fontSize = 'inherit';

              if (isWithinCritical) {
                color = 'error.main';
                fontWeight = 'bold';
                fontSize = '1.1rem';
              } else if (isWithinNormal) {
                color = 'warning.main';
                fontWeight = 'bold';
                fontSize = '1.05rem';
              }

              return (
                <Typography
                  sx={{
                    color: color,
                    fontWeight: fontWeight,
                    fontSize: fontSize,
                  }}
                >
                  {convertedWeight ? convertedWeight.toFixed(2) : '-'}
                </Typography>
              );
            }
            return weight ? (weight * 0.00220462).toFixed(2) : '-';
          },
        },
        {
          field: 'wet',
          headerName: 'Weight Stable Time	',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            return getCmpVal(params.row, 'wet') || '-';
          },
        },
        {
          field: 'lts',
          headerName: 'Weight Lock Count',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            return getCmpVal(params.row, 'lts') || '-';
          },
        },
        {
          field: 'sig',
          headerName: 'Signal',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            return getCmpVal(params.row, 'sig') || '-';
          },
        },
        {
          field: 'bat',
          headerName: 'Battery',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            return getCmpVal(params.row, 'bat') || '-';
          },
        },
        {
          field: 'effectiveDateTime',
          headerName: 'Date/Time',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            return moment(params.row.effectiveDateTime).isValid()
              ? moment(params.row.effectiveDateTime).format('L h:mm:ss A')
              : '-';
          },
        },
        {
          field: 'issued',
          headerName: 'Upload Time',
          width: 180,
          sortable: false,
          valueGetter: (params) => formatDateTime(params.row.issued),
        },
        {
          field: 'weightRange',
          headerName: 'Weight Warning Range',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            const weightThreshold = getCmpVal(params.row, 'weight-threshold');
            const weightVariance = getCmpVal(params.row, 'weight-variance');
            if (weightThreshold && weightVariance) {
              return displayRange(getRange(weightThreshold, weightVariance));
            }
            return '-';
          },
        },
        {
          field: 'weightCriticalRange',
          headerName: 'Weight Critical Range',
          width: 180,
          sortable: false,
          valueGetter: (params) => {
            const weightThreshold = getCmpVal(params.row, 'weight-threshold');
            const weightVariance = getCmpVal(params.row, 'weight-critical-variance');
            if (weightThreshold && weightVariance) {
              return displayRange(getRange(weightThreshold, weightVariance));
            }
            return '-';
          },
        },
      ];
    }

    return columns;
  };

  const getCmpVal = (row: any, field: string): any => {
    return row?.component?.find((x: any) => x.code.text == field)?.valueString ?? null;
  };

  const getRange = (baselineStr: string, varianceStr: string): any[] => {
    const baseline = parseFloat(baselineStr);
    const variance = parseFloat(varianceStr);
    if (isNaN(baseline) || isNaN(variance)) return [];

    const delta = (baseline * variance) / 100;
    const min = baseline - delta;
    const max = baseline + delta;
    return [min, max];
  };

  const displayRange = (numArr: number[]): string => {
    if (numArr.length == 2) {
      return `${numArr[0].toFixed(1)} - ${numArr[1].toFixed(1)}`;
    }
    return '-';
  };

  const columns = generateColumns();
  const rows = transformVitalsToRows();

  console.log(columns);

  return (
    <Paper sx={{ padding: 3 }} component={Stack} spacing={2}>
      {!isModal && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: 5 }}>
              <Typography variant="h4" color="primary.dark" sx={{ flexGrow: 1 }}>
                Device Vitals
              </Typography>
            </Box>
            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ marginBottom: '10' }}>
              Back
            </Button>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              component="span"
              sx={{ cursor: 'pointer', color: 'primary.dark', fontWeight: 600 }}
              onClick={onBack}
            >
              Devices
            </Typography>
            <Typography component="span" color="text.secondary">
              /
            </Typography>
            {isLoading ? (
              <Skeleton width={150} />
            ) : (
              <Typography component="span" sx={{ fontWeight: 500 }}>
                {name ?? '-'}
              </Typography>
            )}
          </Box>
        </>
      )}

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
