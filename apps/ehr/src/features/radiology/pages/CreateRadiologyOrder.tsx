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
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CPTCodeDTO, DiagnosisDTO } from 'utils';
import { createRadiologyOrder } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore, useDebounce, useGetIcd10Search, useSaveChartData } from '../../../telemed';
import { WithRadiologyBreadcrumbs } from '../components/RadiologyBreadcrumbs';

interface CreateRadiologyOrdersProps {
  appointmentID?: string;
}

export const CreateRadiologyOrder: React.FC<CreateRadiologyOrdersProps> = () => {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const [error, setError] = useState<string[] | undefined>(undefined);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const { mutate: saveChartData } = useSaveChartData();
  const { chartData, encounter, appointment, setPartialChartData } = getSelectors(useAppointmentStore, [
    'chartData',
    'encounter',
    'appointment',
    'setPartialChartData',
  ]);

  const { diagnosis } = chartData || {};
  const primaryDiagnosis = diagnosis?.find((d) => d.isPrimary);

  const [orderDx, setOrderDx] = useState<DiagnosisDTO | undefined>(primaryDiagnosis ? primaryDiagnosis : undefined);
  const [orderCpt, setOrderCpt] = useState<CPTCodeDTO | undefined>();
  const [stat, setStat] = useState<boolean>(false);

  // used to fetch dx icd10 codes
  const [dxDebouncedSearchTerm, setDxDebouncedSearchTerm] = useState('');
  const { isFetching: isSearchingDx, data: dxData } = useGetIcd10Search({
    search: dxDebouncedSearchTerm,
    sabs: 'ICD10CM',
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
  const cptSearchOptions = cptData?.codes || [];
  const { debounce } = useDebounce(800);
  const debouncedCptHandleInputChange = (data: string): void => {
    debounce(() => {
      setCptDebouncedSearchTerm(data);
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    const paramsSatisfied = orderDx && orderCpt && encounter.id;
    if (oystehrZambda && paramsSatisfied && encounter.id) {
      try {
        await addAdditionalDxToEncounter();
        await createRadiologyOrder(oystehrZambda, {
          diagnosisCode: orderDx.code,
          cptCode: orderCpt.code,
          encounterId: encounter.id,
          stat: stat,
        });
        navigate(`/in-person/${appointment?.id}/radiology`);
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
