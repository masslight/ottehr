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
  Autocomplete,
  Button,
  Switch,
  FormControlLabel,
  Box,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useAppointmentStore,
  useGetIcd10Search,
  useDebounce,
  ActionsList,
  DeleteIconButton,
  useSaveChartData,
} from '../../../telemed';
import { getSelectors } from '../../../shared/store/getSelectors';
import { DiagnosisDTO, OrderableItemSearchResult } from 'utils';
import { useApiClients } from '../../../hooks/useAppClients';
import Oystehr from '@oystehr/sdk';
import { LabsAutocomplete } from '../components/LabsAutocomplete';
import { createLabOrder, getCreateLabOrderResources } from '../../../api/api';
import { LabOrderLoading } from '../components/labs-orders/LabOrderLoading';
import { enqueueSnackbar } from 'notistack';
import { WithLabBreadcrumbs } from '../components/labs-orders/LabBreadcrumbs';

enum LoadingState {
  initial,
  loading,
  loaded,
  loadedWithError,
}
interface CreateExternalLabOrdersProps {
  appointmentID?: string;
}

export const CreateExternalLabOrder: React.FC<CreateExternalLabOrdersProps> = () => {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const [loadingState, setLoadingState] = useState(LoadingState.initial);
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

  const [orderDx, setOrderDx] = useState<DiagnosisDTO[]>(primaryDiagnosis ? [primaryDiagnosis] : []);
  const [selectedLab, setSelectedLab] = useState<OrderableItemSearchResult | null>(null);
  const [psc, setPsc] = useState<boolean>(true); // defaulting & locking to true for mvp
  const [coverageName, setCoverageName] = useState<string | undefined>(undefined);
  const [labs, setLabs] = useState<OrderableItemSearchResult[]>([]);

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
    async function getResources(oystehrZambda: Oystehr): Promise<void> {
      let loadingError = false;
      setLoadingState(LoadingState.loading);
      try {
        const { coverageName, labs: labsFetched } = await getCreateLabOrderResources(oystehrZambda, { encounter });
        setCoverageName(coverageName);
        setLabs(labsFetched);
      } catch (e) {
        console.error('error loading resources', e);
        const errorMessage = ['There was an error fetching resources to order this lab'];
        setError(errorMessage);
        loadingError = true;
      } finally {
        if (loadingError) {
          setLoadingState(LoadingState.loadedWithError);
        } else {
          setLoadingState(LoadingState.loaded);
        }
      }
    }

    if (encounter.id && oystehrZambda && loadingState === LoadingState.initial) {
      void getResources(oystehrZambda);
    }
  }, [encounter, oystehrZambda, loadingState]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    const paramsSatisfied = orderDx.length && selectedLab;
    if (oystehrZambda && paramsSatisfied) {
      try {
        await addAdditionalDxToEncounter();
        await createLabOrder(oystehrZambda, {
          dx: orderDx,
          encounter,
          orderableItem: selectedLab,
          psc,
        });
        navigate(`/in-person/${appointment?.id}/external-lab-orders`);
      } catch (e) {
        const error = e as any;
        console.log('error', JSON.stringify(error));
        const errorMessage = ['There was an error ordering this lab'];
        setError(errorMessage);
      }
    } else if (!paramsSatisfied) {
      const errorMessage = [];
      if (!orderDx.length) errorMessage.push('Please enter at least one dx');
      if (!selectedLab) errorMessage.push('Please select a lab to order');
      if (errorMessage.length === 0) errorMessage.push('There was an error ordering this lab');
      setError(errorMessage);
    }
    setSubmitting(false);
  };

  const addAdditionalDxToEncounter = async (): Promise<void> => {
    const dxToAdd: DiagnosisDTO[] = [];
    orderDx.forEach((dx) => {
      const alreadyExistsOnEncounter = diagnosis?.find((d) => d.code === dx.code);
      if (!alreadyExistsOnEncounter) {
        dxToAdd.push({
          ...dx,
          isPrimary: false,
          addedViaLabOrder: true,
        });
      }
    });
    if (dxToAdd.length > 0) {
      await new Promise<void>((resolve, reject) => {
        saveChartData(
          {
            diagnosis: dxToAdd,
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
    }
  };

  if (loadingState === LoadingState.loadedWithError) {
    return (
      <Stack spacing={2} sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
            Order Lab
          </Typography>
        </Box>
        <Paper sx={{ p: 3 }}>
          {error?.length && error.length > 0 ? (
            error.map((msg, idx) => (
              <Grid item xs={12} sx={{ paddingTop: 1 }} key={idx}>
                <Typography sx={{ color: theme.palette.error.main }}>{msg}</Typography>
              </Grid>
            ))
          ) : (
            <Grid item xs={12} sx={{ textAlign: 'right', paddingTop: 1 }}>
              <Typography sx={{ color: theme.palette.error.main }}>error</Typography>
            </Grid>
          )}
        </Paper>
      </Stack>
    );
  }

  return (
    <WithLabBreadcrumbs sectionName="Order Lab">
      <Stack spacing={2} sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
            Order Lab
          </Typography>
        </Box>

        {loadingState !== LoadingState.loaded ? (
          <LabOrderLoading />
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
                          } else {
                            enqueueSnackbar('This Dx is already added to the order', {
                              variant: 'error',
                            });
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
                      } else {
                        enqueueSnackbar('This Dx is already added to the order', {
                          variant: 'error',
                        });
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
                  <LabsAutocomplete
                    selectedLab={selectedLab}
                    setSelectedLab={setSelectedLab}
                    labs={labs}
                  ></LabsAutocomplete>
                </Grid>
                <Grid item xs={12}>
                  {/* disabling this field as we are only allowing psc orders for mvp */}
                  <FormControlLabel
                    sx={{ fontSize: '14px' }}
                    control={<Switch checked={psc} onChange={() => setPsc(!psc)} disabled />}
                    label={<Typography variant="body2">PSC</Typography>}
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
                      <Typography sx={{ color: theme.palette.error.main }}>
                        {typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2)}
                      </Typography>
                    </Grid>
                  ))}
              </Grid>
            </Paper>
          </form>
        )}
      </Stack>
    </WithLabBreadcrumbs>
  );
};
