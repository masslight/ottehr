import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  Alert,
  AlertColor,
  Box,
  Paper,
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
  critical: string;
}

type ValidationStatus = 'error' | 'none';

export function ThresholdsTable(): ReactElement {
  const [rows, setRows] = useState<ThresholdRow[]>([
    { metric: 'Systolic', baseline: '', variance: '', critical: '' },
    { metric: 'Diastolic', baseline: '', variance: '', critical: '' },
    { metric: 'Glucose', baseline: '', variance: '', critical: '' },
    { metric: 'Weight (in pounds)', baseline: '', variance: '', critical: '' },
  ]);

  const [originalRows, setOriginalRows] = useState<ThresholdRow[]>([]);
  const [touched, setTouched] = useState<Record<number, { baseline: boolean; variance: boolean; critical: boolean }>>(
    {}
  );
  const { oystehrZambda } = useApiClients();
  const { id: patientId } = useParams<{ id: string }>();
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastSeverity, setToastSeverity] = useState<AlertColor>('error');
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

  const { data } = useQuery(
    ['get-patient-baselines', { oystehrZambda, patientId }],
    () => (oystehrZambda ? getPatientBaselines({ patientId }, oystehrZambda) : null),
    {
      enabled: !!oystehrZambda && !!patientId,
      onSuccess: (response: any): void => {
        console.log('Here is the success', data);
        if (response) {
          const component = response.observations[0].component;
          console.log('component');
          const mappedRows: ThresholdRow[] = [
            {
              metric: 'Systolic',
              baseline: component.find((c: any) => c.code.text === 'systolic-threshold')?.valueString || '',
              variance: component.find((c: any) => c.code.text === 'systolic-variance')?.valueString || '',
              critical: component.find((c: any) => c.code.text === 'systolic-critical-variance')?.valueString || '',
            },
            {
              metric: 'Diastolic',
              baseline: component.find((c: any) => c.code.text === 'diastolic-threshold')?.valueString || '',
              variance: component.find((c: any) => c.code.text === 'diastolic-variance')?.valueString || '',
              critical: component.find((c: any) => c.code.text === 'diastolic-critical-variance')?.valueString || '',
            },
            {
              metric: 'Glucose',
              baseline: component.find((c: any) => c.code.text === 'glucose-threshold')?.valueString || '',
              variance: component.find((c: any) => c.code.text === 'glucose-variance')?.valueString || '',
              critical: component.find((c: any) => c.code.text === 'glucose-critical-variance')?.valueString || '',
            },
            {
              metric: 'Weight (in pounds)',
              baseline: component.find((c: any) => c.code.text === 'weight-threshold')?.valueString || '',
              variance: component.find((c: any) => c.code.text === 'weight-variance')?.valueString || '',
              critical: component.find((c: any) => c.code.text === 'weight-critical-variance')?.valueString || '',
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
      const message = error?.output?.error || 'Failed to update thresholds';
      showToast(message, 'error');
      console.error('Failed to update thresholds:', error);
    },
  });

  const buildComponentArray = (rows: ThresholdRow[]): any[] => {
    return [
      { code: { text: 'systolic-threshold' }, valueString: rows[0].baseline },
      { code: { text: 'systolic-variance' }, valueString: rows[0].variance },
      { code: { text: 'systolic-critical-variance' }, valueString: rows[0].critical },
      { code: { text: 'diastolic-threshold' }, valueString: rows[1].baseline },
      { code: { text: 'diastolic-variance' }, valueString: rows[1].variance },
      { code: { text: 'diastolic-critical-variance' }, valueString: rows[1].critical },
      { code: { text: 'glucose-threshold' }, valueString: rows[2].baseline },
      { code: { text: 'glucose-variance' }, valueString: rows[2].variance },
      { code: { text: 'glucose-critical-variance' }, valueString: rows[2].critical },
      { code: { text: 'weight-threshold' }, valueString: rows[3].baseline },
      { code: { text: 'weight-variance' }, valueString: rows[3].variance },
      { code: { text: 'weight-critical-variance' }, valueString: rows[3].critical },
    ];
  };

  const handleChange = (index: number, field: 'baseline' | 'variance' | 'critical', value: string): void => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

    // Trigger validation for related fields when variance or critical changes
    if (field === 'variance' || field === 'critical') {
      setTouched((prev) => ({
        ...prev,
        [index]: {
          ...prev[index],
          variance: true,
          critical: true,
        },
      }));
    }
  };

  const handleBlur = (index: number, field: 'baseline' | 'variance' | 'critical'): void => {
    setTouched((prev) => ({
      ...prev,
      [index]: {
        ...prev[index],
        [field]: true,
      },
    }));

    // If variance or critical is touched, also mark the other as touched for cross-validation
    if (field === 'variance' && rows[index].critical !== '') {
      setTouched((prev) => ({
        ...prev,
        [index]: {
          ...prev[index],
          critical: true,
        },
      }));
    }
    if (field === 'critical' && rows[index].variance !== '') {
      setTouched((prev) => ({
        ...prev,
        [index]: {
          ...prev[index],
          variance: true,
        },
      }));
    }

    const hasChanges = rows.some(
      (row, i) =>
        row.baseline !== originalRows[i]?.baseline ||
        row.variance !== originalRows[i]?.variance ||
        row.critical !== originalRows[i]?.critical
    );

    if (!hasChanges) return;

    const allFieldsValid = rows.every((row) => {
      const baselineNum = parseFloat(row.baseline);
      const varianceNum = parseFloat(row.variance);
      const criticalNum = parseFloat(row.critical);
      const rules = VALIDATION_RULES[row.metric];

      const isBaselineValid =
        row.baseline !== '' && !isNaN(baselineNum) && baselineNum >= rules.min && baselineNum <= rules.max;
      const isVarianceValid = row.variance !== '' && !isNaN(varianceNum) && varianceNum >= 0 && varianceNum <= 100;
      const isCriticalValid = row.critical !== '' && !isNaN(criticalNum) && criticalNum >= 0 && criticalNum <= 100;

      return isBaselineValid && isVarianceValid && isCriticalValid;
    });

    if (!allFieldsValid) return;

    const invalidVarianceRows = rows.filter((row) => {
      const varianceNum = parseFloat(row.variance);
      const criticalNum = parseFloat(row.critical);
      return !isNaN(varianceNum) && !isNaN(criticalNum) && criticalNum <= varianceNum;
    });

    if (invalidVarianceRows.length > 0) {
      return;
    }

    const componentArray = buildComponentArray(rows);
    updateMutation.mutate(componentArray);
  };

  const VALIDATION_RULES: Record<Metric, { min: number; max: number; message: string }> = {
    Systolic: { min: 70, max: 250, message: 'Systolic must be between 70–250 mmHg' },
    Diastolic: { min: 40, max: 150, message: 'Diastolic must be between 40–150 mmHg' },
    Glucose: { min: 50, max: 500, message: 'Glucose must be between 50–500 mg/dL' },
    'Weight (in pounds)': { min: 30, max: 600, message: 'Weight must be between 30–600 lbs' },
  };

  const getValidationStatus = (
    value: string,
    index: number,
    field: 'baseline' | 'variance' | 'critical',
    row: ThresholdRow
  ): { status: ValidationStatus; message: string; icon: ReactElement | null } => {
    if (!touched[index]?.[field]) {
      return { status: 'none', message: '', icon: null };
    }

    const num = parseFloat(value);

    if (field === 'baseline') {
      const rules = VALIDATION_RULES[row.metric];
      if (value === '' || isNaN(num)) {
        return {
          status: 'error',
          message: 'Baseline value is required',
          icon: <ErrorOutlineIcon color="error" fontSize="small" />,
        };
      }
      if (num < rules.min || num > rules.max) {
        return {
          status: 'error',
          message: rules.message,
          icon: <ErrorOutlineIcon color="error" fontSize="small" />,
        };
      }
      return { status: 'none', message: '', icon: null };
    }

    if (field === 'variance') {
      if (value === '' || isNaN(num)) {
        return {
          status: 'error',
          message: 'Warning variance value is required',
          icon: <ErrorOutlineIcon color="error" fontSize="small" />,
        };
      }
      if (num < 0 || num > 100) {
        return {
          status: 'error',
          message: 'Warning variance must be between 0–100%',
          icon: <ErrorOutlineIcon color="error" fontSize="small" />,
        };
      }

      // Check if variance is greater than or equal to critical
      const criticalNum = parseFloat(row.critical);
      if (touched[index]?.critical && !isNaN(criticalNum) && num >= criticalNum) {
        return {
          status: 'error',
          message: 'Warning variance must be smaller than critical variance',
          icon: <ErrorOutlineIcon color="error" fontSize="small" />,
        };
      }

      return { status: 'none', message: '', icon: null };
    }

    if (field === 'critical') {
      if (value === '' || isNaN(num)) {
        return {
          status: 'error',
          message: 'Critical variance value is required',
          icon: <ErrorOutlineIcon color="error" fontSize="small" />,
        };
      }
      if (num < 0 || num > 100) {
        return {
          status: 'error',
          message: 'Critical variance must be between 0–100%',
          icon: <ErrorOutlineIcon color="error" fontSize="small" />,
        };
      }

      // Check if critical is less than or equal to variance
      const varianceNum = parseFloat(row.variance);
      if (touched[index]?.variance && !isNaN(varianceNum) && num <= varianceNum) {
        return {
          status: 'error',
          message: 'Critical variance must be greater than warning variance',
          icon: <ErrorOutlineIcon color="error" fontSize="small" />,
        };
      }

      return { status: 'none', message: '', icon: null };
    }

    return { status: 'none', message: '', icon: null };
  };

  const getFieldStyles = (status: ValidationStatus): any => {
    if (status === 'error') {
      return {
        '& .MuiOutlinedInput-root': {
          '& fieldset': {
            borderColor: 'error.main',
            borderWidth: 2,
          },
          '&:hover fieldset': {
            borderColor: 'error.main',
          },
          '&.Mui-focused fieldset': {
            borderColor: 'error.main',
          },
        },
      };
    }
    return {};
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

  const getCriticalRange = (baselineStr: string, criticalStr: string): string => {
    const baseline = parseFloat(baselineStr);
    const critical = parseFloat(criticalStr);
    if (isNaN(baseline) || isNaN(critical)) return '-';

    const delta = (baseline * critical) / 100;
    const min = baseline - delta;
    const max = baseline + delta;
    return `${min.toFixed(1)} - ${max.toFixed(1)}`;
  };

  return (
    <>
      <Box sx={{ overflowX: 'auto' }}>
        <TableContainer
          component={Paper}
          sx={{
            border: 'none',
            width: { xs: '350px', sm: 'calc(100% - 250px)', md: 'calc(100% - 100px)', lg: '100%' },
            overflowX: 'auto',
            boxShadow: 'none',
          }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 2 }}>Vitals</TableCell>
                <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 2 }}>Metric</TableCell>
                <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 2 }}>Baseline</TableCell>
                <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 2 }}>
                  Warning <br />
                  Variance (%)
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 2 }}>Warning Range</TableCell>
                <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 2 }}>
                  Critical <br />
                  Variance (%)
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 2 }}>Critical Range</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index): JSX.Element => {
                const baselineValidation = getValidationStatus(row.baseline, index, 'baseline', row);
                const varianceValidation = getValidationStatus(row.variance, index, 'variance', row);
                const criticalValidation = getValidationStatus(row.critical, index, 'critical', row);

                return (
                  <TableRow key={row.metric}>
                    <TableCell sx={{ py: 0.7, px: 2 }}>
                      <IconButton onClick={(e) => handleViewVitals(e, row)}>
                        <VisibilityIcon fontSize="small" sx={{ color: 'primary.main' }} />
                      </IconButton>
                    </TableCell>

                    <TableCell sx={{ py: 0.7, px: 2 }}>{row.metric}</TableCell>

                    <TableCell sx={{ py: 0.7, px: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TextField
                          type="number"
                          size="small"
                          sx={{ minWidth: 90, ...getFieldStyles(baselineValidation.status) }}
                          placeholder={`${row.metric}`}
                          value={row.baseline}
                          inputProps={{ min: 0 }}
                          onChange={(e) => handleChange(index, 'baseline', e.target.value)}
                          onBlur={() => handleBlur(index, 'baseline')}
                        />
                        {baselineValidation.icon && (
                          <Tooltip title={baselineValidation.message}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>{baselineValidation.icon}</Box>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>

                    <TableCell sx={{ py: 0.7, px: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TextField
                          type="number"
                          size="small"
                          inputProps={{ min: 0, max: 100 }}
                          placeholder="Variance"
                          value={row.variance}
                          sx={{ minWidth: 90, ...getFieldStyles(varianceValidation.status) }}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            if (newValue === '' || (/^\d+$/.test(newValue) && +newValue >= 0 && +newValue <= 100)) {
                              handleChange(index, 'variance', newValue);
                            }
                          }}
                          onBlur={() => handleBlur(index, 'variance')}
                        />
                        {varianceValidation.icon && (
                          <Tooltip title={varianceValidation.message}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>{varianceValidation.icon}</Box>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>

                    <TableCell sx={{ py: 0.7, px: 2, minWidth: 120 }}>{getRange(row.baseline, row.variance)}</TableCell>

                    <TableCell sx={{ py: 0.7, px: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TextField
                          type="number"
                          size="small"
                          inputProps={{ min: 0, max: 100 }}
                          placeholder="Critical Variance"
                          value={row.critical}
                          sx={{ minWidth: 90, ...getFieldStyles(criticalValidation.status) }}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            if (newValue === '' || (/^\d+$/.test(newValue) && +newValue >= 0 && +newValue <= 100)) {
                              handleChange(index, 'critical', newValue);
                            }
                          }}
                          onBlur={() => handleBlur(index, 'critical')}
                        />
                        {criticalValidation.icon && (
                          <Tooltip title={criticalValidation.message}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>{criticalValidation.icon}</Box>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>

                    <TableCell sx={{ py: 0.7, px: 2, minWidth: 120 }}>
                      {getCriticalRange(row.baseline, row.critical)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
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
