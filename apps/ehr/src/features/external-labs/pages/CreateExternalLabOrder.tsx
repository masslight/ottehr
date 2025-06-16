import {
  Typography,
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
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useAppointmentStore,
  useGetIcd10Search,
  useDebounce,
  ActionsList,
  DeleteIconButton,
  useSaveChartData,
  useGetCreateExternalLabResources,
} from '../../../telemed';
import { getSelectors } from '../../../shared/store/getSelectors';
import { DiagnosisDTO, OrderableItemSearchResult, PRACTITIONER_CODINGS, PSC_HOLD_LOCALE } from 'utils';
import { useApiClients } from '../../../hooks/useAppClients';
import { LabsAutocomplete } from '../components/LabsAutocomplete';
import { createExternalLabOrder } from '../../../api/api';
import { LabOrderLoading } from '../components/labs-orders/LabOrderLoading';
import { enqueueSnackbar } from 'notistack';
import { LabBreadcrumbs } from '../components/labs-orders/LabBreadcrumbs';
import { OystehrSdkError } from '@oystehr/sdk/dist/cjs/errors';
import DetailPageContainer from 'src/features/common/DetailPageContainer';

interface CreateExternalLabOrdersProps {
  appointmentID?: string;
}

export const CreateExternalLabOrder: React.FC<CreateExternalLabOrdersProps> = () => {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const [error, setError] = useState<string[] | undefined>(undefined);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const { mutate: saveChartData } = useSaveChartData();
  const { chartData, encounter, appointment, patient, setPartialChartData } = getSelectors(useAppointmentStore, [
    'chartData',
    'encounter',
    'appointment',
    'patient',
    'setPartialChartData',
  ]);

  const { diagnosis } = chartData || {};
  const primaryDiagnosis = diagnosis?.find((d) => d.isPrimary);

  const attendingPractitioner = encounter.participant?.find(
    (participant) =>
      participant.type?.find((type) => type.coding?.some((c) => c.system === PRACTITIONER_CODINGS.Attender[0].system))
  );
  const patientId = patient?.id || '';

  const [orderDx, setOrderDx] = useState<DiagnosisDTO[]>(primaryDiagnosis ? [primaryDiagnosis] : []);
  const [selectedLab, setSelectedLab] = useState<OrderableItemSearchResult | null>(null);
  const [psc, setPsc] = useState<boolean>(false);

  // used to fetch dx icd10 codes
  const [debouncedDxSearchTerm, setDebouncedDxSearchTerm] = useState('');
  const { isFetching: isSearching, data } = useGetIcd10Search({ search: debouncedDxSearchTerm, sabs: 'ICD10CM' });
  const icdSearchOptions = data?.codes || [];
  const { debounce } = useDebounce(800);
  const debouncedHandleDxInputChange = (searchValue: string): void => {
    debounce(() => {
      setDebouncedDxSearchTerm(searchValue);
    });
  };

  const {
    isFetching: dataLoading,
    data: createExternalLabResources,
    isError,
    error: resourceFetchError,
  } = useGetCreateExternalLabResources({
    patientId,
  });
  const coverageName = createExternalLabResources?.coverageName;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    const paramsSatisfied = orderDx.length && selectedLab;
    if (oystehrZambda && paramsSatisfied) {
      try {
        await addAdditionalDxToEncounter();
        await createExternalLabOrder(oystehrZambda, {
          dx: orderDx,
          encounter,
          orderableItem: selectedLab,
          psc,
        });
        navigate(`/in-person/${appointment?.id}/external-lab-orders`);
      } catch (e) {
        const oyError = e as OystehrSdkError;
        console.log('error creating external lab order', oyError.code, oyError.message);
        const errorMessage = [oyError.message];
        setError(errorMessage);
      }
    } else if (!paramsSatisfied) {
      const errorMessage = [];
      if (!orderDx.length) errorMessage.push('Please enter at least one dx');
      if (!selectedLab) errorMessage.push('Please select a lab to order');
      if (!attendingPractitioner) errorMessage.push('No attending practitioner has been assigned to this encounter');
      if (errorMessage.length === 0) errorMessage.push('There was an error creating this external lab order');
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

  if (isError || resourceFetchError) {
    return (
      <DetailPageContainer>
        <LabBreadcrumbs sectionName="Order Lab">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
              Order External Lab
            </Typography>
          </Box>
          <Paper sx={{ p: 3 }}>
            {(resourceFetchError as Error) && (
              <Grid item xs={12} sx={{ paddingTop: 1 }}>
                <Typography sx={{ color: theme.palette.error.main }}>
                  {(resourceFetchError as Error)?.message || 'error'}
                </Typography>
              </Grid>
            )}
          </Paper>
        </LabBreadcrumbs>
      </DetailPageContainer>
    );
  }

  return (
    <DetailPageContainer>
      <LabBreadcrumbs sectionName="Order External Lab">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
            Order External Lab
          </Typography>
        </Box>

        {dataLoading ? (
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
                          const alreadySelected = orderDx.find((tempDx) => tempDx.code === selectedDx.code);
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
                      debouncedDxSearchTerm && icdSearchOptions.length === 0
                        ? 'Nothing found for this search criteria'
                        : 'Start typing to load results'
                    }
                    value={null}
                    isOptionEqualToValue={(option, value) => value.code === option.code}
                    onChange={(event: any, selectedDx: any) => {
                      const alreadySelected = orderDx.find((tempDx) => tempDx.code === selectedDx.code);
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
                        onChange={(e) => debouncedHandleDxInputChange(e.target.value)}
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
                    {coverageName || 'unknown'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: '600px', color: theme.palette.primary.dark, marginBottom: '8px' }}
                  >
                    Lab
                  </Typography>
                  <LabsAutocomplete selectedLab={selectedLab} setSelectedLab={setSelectedLab}></LabsAutocomplete>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    sx={{ fontSize: '14px' }}
                    control={<Switch checked={psc} onChange={() => setPsc((psc) => !psc)} />}
                    label={<Typography variant="body2">{PSC_HOLD_LOCALE}</Typography>}
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
      </LabBreadcrumbs>
    </DetailPageContainer>
  );
};
