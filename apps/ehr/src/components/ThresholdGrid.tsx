import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  Alert,
  AlertColor,
  Box,
  Paper,
  Skeleton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from '@mui/material';
import { IconButton } from '@mui/material';
import { ReactElement, useCallback, useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { useParams } from 'react-router-dom';
import { getDevices, getPatientBaselines, updatePatientBaselines } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { DeviceVitalsModal } from './DeviceVitalsModal';

type Metric = 'Systolic' | 'Diastolic' | 'Glucose' | 'Weight (in pounds)';

interface ThresholdRow {
  metric: Metric;
  baseline: string;
  variance: string;
}

export function ThresholdsTable(): ReactElement {
  const [rows, setRows] = useState<ThresholdRow[]>([
    { metric: 'Systolic', baseline: '', variance: '' },
    { metric: 'Diastolic', baseline: '', variance: '' },
    { metric: 'Glucose', baseline: '', variance: '' },
    { metric: 'Weight (in pounds)', baseline: '', variance: '' },
  ]);

  const [originalRows, setOriginalRows] = useState<ThresholdRow[]>([]);
  const [touched, setTouched] = useState<Record<number, { baseline: boolean; variance: boolean }>>({});
  const { oystehrZambda } = useApiClients();
  const { id: patientId } = useParams<{ id: string }>();
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastSeverity, setToastSeverity] = useState<AlertColor>('info');
  const [devicesForModal, setDevicesForModal] = useState<any[]>([]);
  const [_assignedDevices, setAssignedDevices] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDeviceType, setSelectedDeviceType] = useState<string | null>(null);

  const metricToDeviceType: Record<Metric, string> = {
    Systolic: 'BP',
    Diastolic: 'BP',
    Glucose: 'BG',
    'Weight (in pounds)': 'WS',
  };

  const payload = {
    offset: 0,
    count: 500,
    patientId: patientId ? `Patient/${patientId}` : undefined,
  };

  const { refetch: refetchDevices } = useQuery(
    ['get-devices', { patientId, oystehrZambda }],
    () => (oystehrZambda ? getDevices(payload, oystehrZambda) : null),
    {
      enabled: false,
      onSuccess: (response: any) => {
        if (response?.devices) {
          const devices = response.devices.map((device: any) => ({
            id: device.id,
            name: device?.identifier?.[0]?.value || '-',
            distinctIdentifier: device.distinctIdentifier || '-',
            deviceType: device.distinctIdentifier || '',
          }));
          setAssignedDevices(devices);
        } else {
          setAssignedDevices([]);
        }
      },
    }
  );

  const handleViewVitals = async (event: React.MouseEvent<HTMLElement>, row: ThresholdRow): Promise<void> => {
    const deviceType = metricToDeviceType[row.metric];
    setSelectedDeviceType(deviceType);
    const response = await refetchDevices();

    if (response.data?.devices) {
      const devices = response.data.devices.map((device: any) => ({
        id: device.id,
        name: device?.identifier?.[0]?.value || '-',
        manufacturer: device.manufacturer || '-',
        lastUpdated: device?.meta?.lastUpdated || '-',
        serialNumber: device?.serialNumber || '-',
        modelNumber: device?.modelNumber || '-',
        distinctIdentifier: device.distinctIdentifier || '-',
        property: device.property || [],
        deviceType: device.distinctIdentifier || '',
      }));

      const filteredDevices = devices.filter((d: any) => d.deviceType === deviceType);
      setDevicesForModal(filteredDevices);

      if (filteredDevices.length > 0) {
        setModalOpen(true);
      } else {
        showToast(`No ${deviceType} devices found for this patient`, 'warning');
      }
    }
  };

  const showToast = useCallback((message: string, severity: AlertColor = 'info') => {
    setToastMessage(message);
    setToastSeverity(severity);
    setToastOpen(true);
  }, []);

  const handleCloseToast = useCallback(() => {
    setToastOpen(false);
  }, []);

  const { isFetching } = useQuery(
    ['get-patient-baselines', { oystehrZambda, patientId }],
    () => (oystehrZambda ? getPatientBaselines({ patientId }, oystehrZambda) : null),
    {
      enabled: !!oystehrZambda && !!patientId,
      onSuccess: (response: any): void => {
        console.log('Here is the success', response);
        if (response) {
          const component = response.observations[0].component;
          console.log('component');
          const mappedRows: ThresholdRow[] = [
            {
              metric: 'Systolic',
              baseline: component.find((c: any) => c.code.text === 'systolic-threshold')?.valueString || '',
              variance: component.find((c: any) => c.code.text === 'systolic-variance')?.valueString || '',
            },
            {
              metric: 'Diastolic',
              baseline: component.find((c: any) => c.code.text === 'diastolic-threshold')?.valueString || '',
              variance: component.find((c: any) => c.code.text === 'diastolic-variance')?.valueString || '',
            },
            {
              metric: 'Glucose',
              baseline: component.find((c: any) => c.code.text === 'glucose-threshold')?.valueString || '',
              variance: component.find((c: any) => c.code.text === 'glucose-variance')?.valueString || '',
            },
            {
              metric: 'Weight (in pounds)',
              baseline: component.find((c: any) => c.code.text === 'weight-threshold')?.valueString || '',
              variance: component.find((c: any) => c.code.text === 'weight-variance')?.valueString || '',
            },
          ];

          setRows(mappedRows);
          setOriginalRows(mappedRows);
        }
      },
    }
  );

  type BaselineComponent = any;

  const updateBaselineFn = (components: BaselineComponent[]): Promise<any> => {
    return updatePatientBaselines({ patientId, component: components }, oystehrZambda!) as any;
  };

  const updateMutation = useMutation<unknown, Error, BaselineComponent[]>(updateBaselineFn, {
    onSuccess: (response: any) => {
      const message = response?.message || 'Thresholds updated successfully';
      showToast(message, 'success');
      setOriginalRows(rows);
    },
    onError: (error: any) => {
      const message = error?.error || 'Failed to update thresholds';
      showToast(message, 'error');
      console.error('Failed to update thresholds:', error);
    },
  });

  const buildComponentArray = (rows: ThresholdRow[]): any[] => {
    return [
      { code: { text: 'systolic-threshold' }, valueString: rows[0].baseline },
      { code: { text: 'systolic-variance' }, valueString: rows[0].variance },
      { code: { text: 'diastolic-threshold' }, valueString: rows[1].baseline },
      { code: { text: 'diastolic-variance' }, valueString: rows[1].variance },
      { code: { text: 'glucose-threshold' }, valueString: rows[2].baseline },
      { code: { text: 'glucose-variance' }, valueString: rows[2].variance },
      { code: { text: 'weight-threshold' }, valueString: rows[3].baseline },
      { code: { text: 'weight-variance' }, valueString: rows[3].variance },
    ];
  };

  const handleChange = (index: number, field: 'baseline' | 'variance', value: string): void => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const handleBlur = (index: number, field: 'baseline' | 'variance'): void => {
    setTouched((prev) => ({
      ...prev,
      [index]: {
        ...prev[index],
        [field]: true,
      },
    }));

    const hasChanges = rows.some(
      (row, i) => row.baseline !== originalRows[i]?.baseline || row.variance !== originalRows[i]?.variance
    );

    if (!hasChanges) {
      return;
    }

    const allFieldsValid = rows.every((row) => {
      const baselineNum = parseFloat(row.baseline);
      const varianceNum = parseFloat(row.variance);
      const rules = VALIDATION_RULES[row.metric];

      const isBaselineValid =
        row.baseline !== '' && !isNaN(baselineNum) && baselineNum >= rules.min && baselineNum <= rules.max;

      const isVarianceValid = row.variance !== '' && !isNaN(varianceNum) && varianceNum >= 0 && varianceNum <= 100;

      return isBaselineValid && isVarianceValid;
    });

    if (allFieldsValid) {
      const componentArray = buildComponentArray(rows);
      updateMutation.mutate(componentArray);
    }
  };

  const VALIDATION_RULES: Record<Metric, { min: number; max: number; message: string }> = {
    Systolic: { min: 70, max: 250, message: 'Systolic must be between 70–250 mmHg' },
    Diastolic: { min: 40, max: 150, message: 'Diastolic must be between 40–150 mmHg' },
    Glucose: { min: 50, max: 500, message: 'Glucose must be between 50–500 mg/dL' },
    'Weight (in pounds)': { min: 30, max: 600, message: 'Weight must be between 30–600 lbs' },
  };

  const getRange = (baselineStr: string, varianceStr: string): string => {
    const baseline = parseFloat(baselineStr);
    const variance = parseFloat(varianceStr);
    if (isNaN(baseline) || isNaN(variance)) return '-';

    const delta = (baseline * variance) / 100;
    const min = baseline - delta;
    const max = baseline + delta;
    return `${min.toFixed(1)} - ${max.toFixed(1)}`;
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {isFetching ? (
          <TableContainer component={Paper} sx={{ border: 'none', boxShadow: 'none' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 2 }}>View Vitals</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 2 }}>Metric</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 2 }}>Baseline</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 2 }}>Variance (%)</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 7 }}>Range</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[1, 2, 3, 4].map((i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ py: 0.7, px: 2 }}>
                      <Skeleton width={10} />
                    </TableCell>
                    <TableCell sx={{ py: 0.7, px: 2 }}>
                      <Skeleton width={120} />
                    </TableCell>
                    <TableCell sx={{ py: 0.7, px: 2 }}>
                      <Skeleton width={100} height={40} />
                    </TableCell>
                    <TableCell sx={{ py: 0.7, px: 2 }}>
                      <Skeleton width={100} height={40} />
                    </TableCell>
                    <TableCell sx={{ py: 0.7, px: 2 }}>
                      <Skeleton width={140} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <TableContainer component={Paper} sx={{ border: 'none', boxShadow: 'none' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 2 }}>View Vitals</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 2 }}>Metric</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 2 }}>Baseline</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 2 }}>Variance (%)</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 2 }}>Range</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, index): JSX.Element => {
                  const baselineNum = parseFloat(row.baseline);
                  const varianceNum = parseFloat(row.variance);
                  const rules = VALIDATION_RULES[row.metric];

                  const hasBaselineError =
                    touched[index]?.baseline &&
                    (row.baseline === '' || isNaN(baselineNum) || baselineNum < rules.min || baselineNum > rules.max);

                  const hasVarianceError =
                    touched[index]?.variance &&
                    (row.variance === '' || isNaN(varianceNum) || varianceNum < 0 || varianceNum > 100);

                  return (
                    <TableRow key={row.metric}>
                      <TableCell sx={{ py: 0.7, px: 2 }}>
                        <IconButton onClick={(e) => handleViewVitals(e, row)}>
                          <VisibilityIcon fontSize="small" sx={{ color: 'primary.main' }} />
                        </IconButton>
                      </TableCell>

                      <TableCell sx={{ py: 0.7, px: 2 }}>{row.metric}</TableCell>

                      <TableCell sx={{ py: 0.7, px: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <TextField
                            type="number"
                            size="small"
                            sx={{ maxWidth: 180 }}
                            placeholder={`${row.metric}`}
                            value={row.baseline}
                            inputProps={{ min: 0 }}
                            error={hasBaselineError}
                            onChange={(e) => handleChange(index, 'baseline', e.target.value)}
                            onBlur={() => handleBlur(index, 'baseline')}
                          />
                          {hasBaselineError && (
                            <Tooltip title={row.baseline === '' ? 'Baseline value is required' : rules.message}>
                              <ErrorOutlineIcon color="error" fontSize="small" style={{ marginLeft: 6 }} />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>

                      <TableCell sx={{ py: 0.7, px: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <TextField
                            type="number"
                            size="small"
                            inputProps={{ min: 0, max: 100 }}
                            placeholder="Variance"
                            value={row.variance}
                            sx={{ minWidth: 120 }}
                            error={hasVarianceError}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              if (newValue === '' || (/^\d+$/.test(newValue) && +newValue >= 0 && +newValue <= 100)) {
                                handleChange(index, 'variance', newValue);
                              }
                            }}
                            onBlur={() => handleBlur(index, 'variance')}
                          />
                          {hasVarianceError && (
                            <Tooltip
                              title={
                                row.variance === '' ? 'Variance value is required' : 'Variance must be between 0–100%'
                              }
                            >
                              <ErrorOutlineIcon color="error" fontSize="small" style={{ marginLeft: 6 }} />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>

                      <TableCell sx={{ py: 0.7, px: 2, minWidth: 120 }}>
                        {getRange(row.baseline, row.variance)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <DeviceVitalsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        devices={devicesForModal}
        deviceType={selectedDeviceType || ''}
        patientId={patientId || ''}
      />

      <Snackbar
        open={toastOpen}
        autoHideDuration={6000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseToast} severity={toastSeverity} sx={{ width: '100%' }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </>
  );
}
