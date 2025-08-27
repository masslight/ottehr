import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
  Box,
  Button,
  FormControlLabel,
  Grid,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { Coding } from 'fhir/r4b';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRadiologyUrl } from 'src/features/css-module/routing/helpers';
import { CPTCodeDTO, DiagnosisDTO } from 'utils';
import { createRadiologyOrder } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import {
  useAppointmentData,
  useChartData,
  useDebounce,
  useGetIcd10Search,
  useICD10SearchNew,
  useSaveChartData,
} from '../../../telemed';
import { WithRadiologyBreadcrumbs } from '../components/RadiologyBreadcrumbs';

interface CreateRadiologyOrdersProps {
  appointmentID?: string;
}

const defaultStudies: Pick<Coding, 'code' | 'display'>[] = [
  { code: '71045', display: 'X-ray of chest, 1 view' },
  { code: '71046', display: 'X-ray of chest, 2 views' },
  { code: '74018', display: 'X-ray of abdomen, 1 view' },
  { code: '74019', display: 'X-ray of abdomen, 2 views' },
  { code: '76010', display: 'X-ray from nose to rectum' },
  { code: '73000', display: 'X-ray of collar bone' },
  { code: '73010', display: 'X-ray of shoulder blade' },
  { code: '73020', display: 'X-ray of shoulder, 1 view' },
  { code: '73060', display: 'X-ray of upper arm, minimum of 2 views' },
  { code: '73070', display: 'X-ray of elbow, 2 views' },
  { code: '73090', display: 'X-ray of forearm, 2 views' },
  { code: '73100', display: 'X-ray of wrist, 2 views' },
  { code: '73120', display: 'X-ray of hand, 2 views' },
  { code: '73140', display: 'X-ray of finger, minimum of 2 views' },
  { code: '72170', display: 'X-ray of pelvis, 1-2 views' },
  { code: '73552', display: 'X-ray of thigh bone, minimum 2 views' },
  { code: '73560', display: 'X-ray of knee, 1-2 views' },
  { code: '73590', display: 'X-ray of lower leg, 2 views' },
  { code: '73600', display: 'X-ray of ankle, 2 views' },
  { code: '73610', display: 'X-ray of ankle, minimum of 3 views' },
  { code: '73620', display: 'X-ray of foot, 2 views' },
  { code: '73630', display: 'X-ray of foot, minimum of 3 views' },
  { code: '73660', display: 'X-ray of toe, minimum of 2 views' },
];

export const CreateRadiologyOrder: React.FC<CreateRadiologyOrdersProps> = () => {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const [error, setError] = useState<string[] | undefined>(undefined);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const { mutate: saveChartData } = useSaveChartData();
  const { encounter, appointment } = useAppointmentData();
  const { chartData, setPartialChartData } = useChartData();
  const { diagnosis } = chartData || {};
  const primaryDiagnosis = diagnosis?.find((d) => d.isPrimary);
  const [orderDx, setOrderDx] = useState<DiagnosisDTO | undefined>(primaryDiagnosis ? primaryDiagnosis : undefined);
  const [orderCpt, setOrderCpt] = useState<CPTCodeDTO | undefined>();
  const [stat, setStat] = useState<boolean>(false);
  const [clinicalHistory, setClinicalHistory] = useState<string | undefined>();

  // used to fetch dx icd10 codes
  const [dxDebouncedSearchTerm, setDxDebouncedSearchTerm] = useState('');
  const { isFetching: isSearchingDx, data: dxData } = useICD10SearchNew({
    search: dxDebouncedSearchTerm,
  });
  const icdSearchOptions = dxDebouncedSearchTerm === '' && diagnosis ? diagnosis : dxData?.codes || [];
  const { debounce: debounceDx } = useDebounce(800);
  const debouncedDxHandleInputChange = (data: string): void => {
    debounceDx(() => {
      setDxDebouncedSearchTerm(data);
    });
  };

  // used to fetch cpt codes
  const [cptDebouncedSearchTerm, setCptDebouncedSearchTerm] = useState('');
  const { isFetching: isSearchingCpt, data: cptData } = useGetIcd10Search({
    search: cptDebouncedSearchTerm,
    sabs: 'CPT',
    radiologyOnly: true, // Only fetch CPT codes related to radiology
  });
  const cptSearchOptions = cptData?.codes || defaultStudies;
  const { debounce } = useDebounce(800);
  const debouncedCptHandleInputChange = (data: string): void => {
    debounce(() => {
      setCptDebouncedSearchTerm(data);
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    const paramsSatisfied = orderDx && orderCpt && encounter.id && clinicalHistory && clinicalHistory.length <= 255;
    if (oystehrZambda && paramsSatisfied && encounter.id) {
      try {
        await addAdditionalDxToEncounter();
        await createRadiologyOrder(oystehrZambda, {
          diagnosisCode: orderDx.code,
          cptCode: orderCpt.code,
          encounterId: encounter.id,
          stat: stat,
          clinicalHistory: clinicalHistory,
        });
        navigate(getRadiologyUrl(appointment?.id || ''));
      } catch (e) {
        const error = e as any;
        console.log('error', JSON.stringify(error));
        const errorMessage = ['There was an error completing the order'];
        setError(errorMessage);
      }
    } else if (!paramsSatisfied) {
      const errorMessage = [];
      if (!orderDx) errorMessage.push('Please enter a diagnosis to continue');
      if (!orderCpt) errorMessage.push('Please select a study type (CPT code) to continue');
      if (!clinicalHistory) errorMessage.push('Please enter clinical history to continue');
      if (clinicalHistory && clinicalHistory.length > 255)
        errorMessage.push('Clinical history must be 255 characters or less');
      if (errorMessage.length === 0) errorMessage.push('There was an error completing the order');
      setError(errorMessage);
    }
    setSubmitting(false);
  };

  const addAdditionalDxToEncounter = async (): Promise<void> => {
    if (orderDx === undefined) return;

    const alreadyExistsOnEncounter = diagnosis?.find((d) => d.code === orderDx.code);
    if (alreadyExistsOnEncounter) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      saveChartData(
        {
          diagnosis: [orderDx],
        },
        {
          onSuccess: (data) => {
            const returnedDiagnosis = data.chartData.diagnosis || [];
            const allDx = [...returnedDiagnosis, ...(diagnosis || [])];
            if (allDx) {
              setPartialChartData({
                diagnosis: [...allDx],
              });
            }
            resolve();
          },
          onError: (error) => {
            reject(error);
          },
        }
      );
    });
  };

  return (
    <WithRadiologyBreadcrumbs sectionName="Order Radiology">
      <Stack spacing={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
            Order Radiology
          </Typography>
        </Box>

        <form onSubmit={handleSubmit}>
          <Paper sx={{ p: 3 }}>
            <Grid container sx={{ width: '100%' }} spacing={1} rowSpacing={2}>
              <Grid item xs={12}>
                <Autocomplete
                  blurOnSelect
                  id="select-dx"
                  size="small"
                  fullWidth
                  filterOptions={(x) => x}
                  noOptionsText={
                    dxDebouncedSearchTerm && icdSearchOptions.length === 0
                      ? 'Nothing found for this search criteria'
                      : 'Start typing to load results'
                  }
                  value={orderDx || null}
                  isOptionEqualToValue={(option, value) => value.code === option.code}
                  onChange={(_event: any, selectedDx: any) => {
                    setOrderDx(selectedDx);
                  }}
                  loading={isSearchingDx}
                  options={icdSearchOptions}
                  getOptionLabel={(option) =>
                    typeof option === 'string' ? option : `${option.code} ${option.display}`
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      onChange={(e) => debouncedDxHandleInputChange(e.target.value)}
                      label="Diagnosis"
                      placeholder="Select diagnosis from list or search"
                      multiline
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Autocomplete
                  blurOnSelect
                  id="select-cpt"
                  size="small"
                  fullWidth
                  filterOptions={(x) => x}
                  noOptionsText={
                    cptDebouncedSearchTerm && cptSearchOptions.length === 0
                      ? 'Nothing found for this search criteria'
                      : 'Start typing to load results'
                  }
                  value={orderCpt || null}
                  isOptionEqualToValue={(option, value) => value.code === option.code}
                  onChange={(_event: any, selectedCpt: any) => {
                    setOrderCpt(selectedCpt);
                  }}
                  loading={isSearchingCpt}
                  options={cptSearchOptions}
                  getOptionLabel={(option) =>
                    typeof option === 'string' ? option : `${option.code} ${option.display}`
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      onChange={(e) => debouncedCptHandleInputChange(e.target.value)}
                      label="Study Type"
                      placeholder="Search for CPT Code"
                      multiline
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  id="clinical-history"
                  label="Clinical History"
                  placeholder="Enter clinical history for the radiology order"
                  fullWidth
                  multiline
                  size="small"
                  value={clinicalHistory}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 255) {
                      setClinicalHistory(value);
                    }
                  }}
                  error={clinicalHistory !== undefined && clinicalHistory.length > 255}
                  helperText={
                    clinicalHistory !== undefined && clinicalHistory.length > 255
                      ? 'Clinical history must be 255 characters or less'
                      : `${clinicalHistory?.length || 0}/255 characters`
                  }
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  sx={{ fontSize: '14px' }}
                  control={<Switch checked={stat} onChange={() => setStat(!stat)} />}
                  label={<Typography variant="body2">STAT</Typography>}
                />
              </Grid>
              <Grid item xs={6}>
                <Button
                  variant="outlined"
                  sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}
                  onClick={() => {
                    navigate(`/in-person/${appointment?.id}/radiology`);
                  }}
                >
                  Cancel
                </Button>
              </Grid>
              <Grid item xs={6} display="flex" justifyContent="flex-end">
                <LoadingButton
                  loading={submitting}
                  type="submit"
                  variant="contained"
                  sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}
                >
                  Order
                </LoadingButton>
              </Grid>
              {error &&
                error.length > 0 &&
                error.map((msg, idx) => (
                  <Grid item xs={12} sx={{ textAlign: 'right', paddingTop: 1 }} key={idx}>
                    <Typography sx={{ color: theme.palette.error.main }}>
                      {typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2)}
                    </Typography>
                  </Grid>
                ))}
            </Grid>
          </Paper>
        </form>
      </Stack>
    </WithRadiologyBreadcrumbs>
  );
};
