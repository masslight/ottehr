import {
  Typography,
  Stack,
  useTheme,
  Paper,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Grid,
  TextField,
  CircularProgress,
  Autocomplete,
  Button,
  Switch,
  FormControlLabel,
  Box,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppointmentStore, useGetIcd10Search, useDebounce, ActionsList, DeleteIconButton } from '../../../telemed';
import { getSelectors } from '../../../shared/store/getSelectors';
import { DiagnosisDTO, OrderableItemSearchResult, SELF_PAY_CODING, CODE_SYSTEM_COVERAGE_CLASS } from 'utils';
import { useApiClients } from '../../../hooks/useAppClients';
import { Coverage } from 'fhir/r4b';
import useEvolveUser from '../../../hooks/useEvolveUser';
import Oystehr from '@oystehr/sdk';
import { LabsAutocomplete } from '../components/LabsAutocomplete';
import { createLabOrder } from '../../../api/api';
import { OystehrSdkError } from '@oystehr/sdk/dist/cjs/errors';

enum LoadingState {
  initial,
  loading,
  loaded,
}
interface CreateExternalLabOrdersProps {
  appointmentID?: string;
}

export const CreateExternalLabOrder: React.FC<CreateExternalLabOrdersProps> = () => {
  const theme = useTheme();
  const { oystehr, oystehrZambda } = useApiClients();
  const user = useEvolveUser();
  const navigate = useNavigate();
  const practitionerId = user?.profile.replace('Practitioner/', '');
  const [loadingState, setLoadingState] = useState(LoadingState.initial);
  const [error, setError] = useState<string[] | undefined>(undefined);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const { chartData, encounter, appointment } = getSelectors(useAppointmentStore, [
    'chartData',
    'encounter',
    'appointment',
  ]);
  const { diagnosis, patientId } = chartData || {};
  const primaryDiagnosis = diagnosis?.find((d) => d.isPrimary);

  const [orderDx, setOrderDx] = useState<DiagnosisDTO[]>(primaryDiagnosis ? [primaryDiagnosis] : []);
  const [selectedLab, setSelectedLab] = useState<OrderableItemSearchResult | null>(null);
  const [pscHold, setPscHold] = useState<boolean>(true); // defaulting & locking to true for mvp
  const [coverage, setCoverage] = useState<Coverage | undefined>(undefined);

  // used to fetch dx icd10 codes
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const { isFetching: isSearching, data } = useGetIcd10Search({ search: debouncedSearchTerm, sabs: 'ICD10CM' });
  const icdSearchOptions = data?.codes || [];
  const { debounce } = useDebounce(800);
  const debouncedHandleInputChange = (data: string): void => {
    debounce(() => {
      setDebouncedSearchTerm(data);
    });
  };

  useEffect(() => {
    async function getPatientCoverage(oystehr: Oystehr): Promise<void> {
      setLoadingState(LoadingState.loading);
      try {
        const coverageResults = (
          await oystehr.fhir.search<Coverage>({
            resourceType: 'Coverage',
            params: [{ name: 'patient', value: `Patient/${patientId}` }],
          })
        ).unbundle();
        // todo is there a way to confirm primary?
        setCoverage(coverageResults[0]);
      } catch (e) {
        console.error('error loading locations', e);
      } finally {
        setLoadingState(LoadingState.loaded);
      }
    }

    if (patientId && oystehr && loadingState === LoadingState.initial) {
      void getPatientCoverage(oystehr);
    }
  }, [patientId, oystehr, loadingState]);

  const coverageName = useMemo(() => {
    if (!coverage) return;
    const isSelfPay = !!coverage.type?.coding?.find((coding) => coding.system === SELF_PAY_CODING.system);
    if (isSelfPay) return 'Self Pay'; // todo check that this is implemented / or being implmented
    const coveragePlanClass = coverage.class?.find(
      (c) => c.type.coding?.find((code) => code.system === CODE_SYSTEM_COVERAGE_CLASS)
    );
    return coveragePlanClass?.name;
  }, [coverage]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    const paramsSatisfied = orderDx.length && patientId && practitionerId && selectedLab && coverage;
    if (oystehrZambda && paramsSatisfied) {
      try {
        await createLabOrder(oystehrZambda, {
          dx: orderDx,
          encounter,
          practitionerId,
          orderableItem: selectedLab,
          pscHold,
        });
        navigate(`/in-person/${appointment?.id}/external-lab-orders`);
      } catch (e) {
        const oysterError = e as OystehrSdkError;
        const errorMessage = oysterError?.message ? [oysterError?.message] : ['There was an error ordering this lab'];
        setError(errorMessage);
      }
    } else if (!paramsSatisfied) {
      console.log('missing required params');
      const errorMessage = [];
      if (!orderDx.length) errorMessage.push('Please enter at least one dx');
      if (!coverage) errorMessage.push('Patient insurance is missing, you cannot submit a lab order without one');
      if (!selectedLab) errorMessage.push('Please select a lab to order');
      if (errorMessage.length === 0) errorMessage.push('There was an error ordering this lab');
      setError(errorMessage);
    }
    setSubmitting(false);
  };

  return (
    <Stack spacing={2} sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
        Order Lab
      </Typography>
      {loadingState !== LoadingState.loaded ? (
        <CircularProgress />
      ) : (
        <form onSubmit={handleSubmit}>
          <Paper sx={{ p: 3 }}>
            <Grid container sx={{ width: '100%' }} spacing={1} rowSpacing={2}>
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
                  Dx
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel id="select-dx-label" shrink>
                    Dx
                  </InputLabel>
                  <Select
                    notched
                    fullWidth
                    id="select-dx"
                    label="Dx"
                    onChange={(e) => {
                      const selectedDxCode = e.target.value;
                      const selectedDx = diagnosis?.find((tempDx) => tempDx.code === selectedDxCode);
                      if (selectedDx) {
                        const alreadySelected = orderDx.find((tempdx) => tempdx.code === selectedDx.code);
                        if (!alreadySelected) {
                          setOrderDx([...orderDx, selectedDx]);
                        }
                      }
                    }}
                    displayEmpty
                    value=""
                    sx={{
                      '& .MuiInputLabel-root': {
                        top: -8,
                      },
                    }}
                    size="small"
                  >
                    <MenuItem value="" disabled>
                      <Typography sx={{ color: '#9E9E9E' }}>Add a Dx to Order</Typography>
                    </MenuItem>
                    {diagnosis?.map((d) => (
                      <MenuItem id={d.resourceId} key={d.resourceId} value={d.code}>
                        {d.code} {d.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Autocomplete
                  blurOnSelect
                  id="select-additional-dx"
                  size="small"
                  fullWidth
                  noOptionsText={
                    debouncedSearchTerm && icdSearchOptions.length === 0
                      ? 'Nothing found for this search criteria'
                      : 'Start typing to load results'
                  }
                  value={null}
                  isOptionEqualToValue={(option, value) => value.code === option.code}
                  onChange={(event: any, selectedDx: any) => {
                    const alreadySelected = orderDx.find((tempdx) => tempdx.code === selectedDx.code);
                    if (!alreadySelected) {
                      setOrderDx([...orderDx, selectedDx]);
                    }
                  }}
                  loading={isSearching}
                  options={icdSearchOptions}
                  getOptionLabel={(option) =>
                    typeof option === 'string' ? option : `${option.code} ${option.display}`
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      onChange={(e) => debouncedHandleInputChange(e.target.value)}
                      label="Additional Dx"
                      placeholder="Search for Dx if not on list above"
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                />
              </Grid>
              {orderDx.length > 0 && (
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <ActionsList
                      data={orderDx}
                      getKey={(value, index) => value.resourceId || index}
                      renderItem={(value) => (
                        <Typography>
                          {value.display} {value.code}
                        </Typography>
                      )}
                      renderActions={(value) => (
                        <DeleteIconButton
                          onClick={() => setOrderDx(() => orderDx.filter((dxVal) => dxVal.code !== value.code))}
                        />
                      )}
                    />
                  </Box>
                </Grid>
              )}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
                  Patient insurance
                </Typography>
                <Typography variant="body2" sx={{ paddingTop: '8px' }}>
                  {coverageName}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
                  Lab
                </Typography>
                <LabsAutocomplete selectedLab={selectedLab} setSelectedLab={setSelectedLab}></LabsAutocomplete>
              </Grid>
              <Grid item xs={12}>
                {/* disabling this field as we are only allowing psc hold orders for mvp */}
                <FormControlLabel
                  sx={{ fontSize: '14px' }}
                  control={<Switch checked={pscHold} onChange={() => setPscHold(!pscHold)} disabled />}
                  label={<Typography variant="body2">PSC Hold</Typography>}
                />
              </Grid>
              <Grid item xs={6}>
                <Button
                  variant="outlined"
                  sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}
                  onClick={() => {
                    navigate(`/in-person/${appointment?.id}/external-lab-orders`);
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
                    <Typography sx={{ color: theme.palette.error.main }}>{msg}</Typography>
                  </Grid>
                ))}
            </Grid>
          </Paper>
        </form>
      )}
    </Stack>
  );
};
