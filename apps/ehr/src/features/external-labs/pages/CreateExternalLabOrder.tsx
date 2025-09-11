import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DetailPageContainer from 'src/features/common/DetailPageContainer';
import {
  DiagnosisDTO,
  getAttendingPractitionerId,
  ModifiedOrderingLocation,
  OrderableItemSearchResult,
  PSC_HOLD_LOCALE,
} from 'utils';
import { createExternalLabOrder } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import {
  ActionsList,
  DeleteIconButton,
  useAppointmentData,
  useChartData,
  useDebounce,
  useGetCreateExternalLabResources,
  useICD10SearchNew,
  useSaveChartData,
} from '../../../telemed';
import { LabBreadcrumbs } from '../components/labs-orders/LabBreadcrumbs';
import { LabOrderLoading } from '../components/labs-orders/LabOrderLoading';
import { LabsAutocomplete } from '../components/LabsAutocomplete';

interface CreateExternalLabOrdersProps {
  appointmentID?: string;
}

type LocationMapValue = {
  location: ModifiedOrderingLocation;
  labOrgIds: string;
};

export const CreateExternalLabOrder: React.FC<CreateExternalLabOrdersProps> = () => {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const [error, setError] = useState<string[] | undefined>(undefined);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const { mutate: saveChartData } = useSaveChartData();
  const { encounter, appointment, patient, location: apptLocation } = useAppointmentData();
  const { chartData, setPartialChartData } = useChartData();
  const { diagnosis } = chartData || {};
  const primaryDiagnosis = diagnosis?.find((d) => d.isPrimary);
  const attendingPractitionerId = getAttendingPractitionerId(encounter);
  const patientId = patient?.id || '';
  const [orderDx, setOrderDx] = useState<DiagnosisDTO[]>(primaryDiagnosis ? [primaryDiagnosis] : []);
  const [selectedLab, setSelectedLab] = useState<OrderableItemSearchResult | null>(null);
  const [psc, setPsc] = useState<boolean>(false);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>('');
  const [labOrgIdsForSelectedOffice, setLabOrgIdsForSelectedOffice] = useState<string>('');
  const [isOrderingDisabled, setIsOrderingDisabled] = useState<boolean>(false);

  // used to fetch dx icd10 codes
  const [debouncedDxSearchTerm, setDebouncedDxSearchTerm] = useState('');
  const { isFetching: isSearching, data } = useICD10SearchNew({ search: debouncedDxSearchTerm });
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

  const orderingLocations = createExternalLabResources?.orderingLocations ?? [];
  const orderingLocationIdsStable = (createExternalLabResources?.orderingLocationIds ?? []).join(',');

  const orderingLocationIdToLocationAndLabGuidsMap = useMemo(
    () =>
      new Map<string, LocationMapValue>(
        orderingLocations.map((loc) => [
          loc.id,
          {
            location: loc,
            labOrgIds: loc.enabledLabs.map((lab) => lab.labOrgRef.replace('Organization/', '')).join(','),
          },
        ])
      ),
    [orderingLocationIdsStable] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (!apptLocation?.id) return;

    if (orderingLocationIdToLocationAndLabGuidsMap.has(apptLocation.id) && !selectedOfficeId) {
      setSelectedOfficeId(apptLocation.id);
      console.log('we did the state set');
    }
  }, [apptLocation?.id, selectedOfficeId, orderingLocationIdToLocationAndLabGuidsMap]);

  useEffect(() => {
    const labOrgIds = orderingLocationIdToLocationAndLabGuidsMap.get(selectedOfficeId)?.labOrgIds ?? '';
    console.log(`lab org ids for selectedOfficeId ${selectedOfficeId}`, labOrgIds);
    setLabOrgIdsForSelectedOffice(labOrgIds);
  }, [selectedOfficeId, orderingLocationIdToLocationAndLabGuidsMap]);

  useEffect(() => {
    if (!apptLocation && !selectedOfficeId) {
      setError(['Please select an ordering office to continue']);
      setIsOrderingDisabled(true);
    } else if (
      apptLocation &&
      (!selectedOfficeId || !orderingLocationIdToLocationAndLabGuidsMap.has(selectedOfficeId))
    ) {
      setError(['Office is not configured to order labs. Please select another office']);
      setIsOrderingDisabled(true);
    } else {
      setError(undefined);
      setIsOrderingDisabled(false);
    }
  }, [apptLocation, selectedOfficeId, orderingLocationIdToLocationAndLabGuidsMap]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    const paramsSatisfied =
      orderDx.length &&
      selectedLab &&
      selectedOfficeId &&
      orderingLocationIdToLocationAndLabGuidsMap.has(selectedOfficeId);
    if (oystehrZambda && paramsSatisfied) {
      try {
        await addAdditionalDxToEncounter();
        await createExternalLabOrder(oystehrZambda, {
          dx: orderDx,
          encounter,
          orderableItem: selectedLab,
          psc,
          orderingLocation: orderingLocationIdToLocationAndLabGuidsMap.get(selectedOfficeId)!.location,
        });
        navigate(`/in-person/${appointment?.id}/external-lab-orders`);
      } catch (e) {
        const sdkError = e as Oystehr.OystehrSdkError;
        console.log('error creating external lab order', sdkError.code, sdkError.message);
        const errorMessage = [sdkError.message];
        setError(errorMessage);
      }
    } else if (!paramsSatisfied) {
      const errorMessage = [];
      if (!orderDx.length) errorMessage.push('Please enter at least one dx');
      if (!selectedLab) errorMessage.push('Please select a lab to order');
      if (!attendingPractitionerId) errorMessage.push('No attending practitioner has been assigned to this encounter');
      if (!(selectedOfficeId && orderingLocationIdToLocationAndLabGuidsMap.has(selectedOfficeId)))
        errorMessage.push('No office selected, or office is not configured to order labs');
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
        <LabBreadcrumbs sectionName="Order External Lab">
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
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: '600px', color: theme.palette.primary.dark, marginBottom: '8px' }}
                  >
                    Ordering Office
                  </Typography>
                  <Grid item xs={12}>
                    <FormControl fullWidth required>
                      <InputLabel id="select-office-label" shrink>
                        Office
                      </InputLabel>
                      <Select
                        notched
                        fullWidth
                        id="select-office"
                        label="office"
                        onChange={(e) => {
                          console.log('Selected office value', e.target.value);
                          setSelectedOfficeId(e.target.value);
                          if (!e.target.value)
                            enqueueSnackbar('Must select an ordering office', {
                              variant: 'error',
                            });
                          // future TODO: should clear out the selected lab only if the selected lab isn't from the same labguid as what the location supports
                          setSelectedLab(null);
                        }}
                        displayEmpty
                        value={selectedOfficeId ?? ''}
                        sx={{
                          '& .MuiInputLabel-root': {
                            top: -8,
                          },
                        }}
                        size="small"
                      >
                        <MenuItem value="" disabled>
                          <Typography sx={{ color: '#9E9E9E' }}>Select an Ordering Office</Typography>
                        </MenuItem>
                        {orderingLocations.map((loc) =>
                          loc.id ? (
                            <MenuItem id={loc.id} key={loc.id} value={loc.id}>
                              {loc.name}
                            </MenuItem>
                          ) : null
                        )}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
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
                      {diagnosis?.map((d, idx) => (
                        <MenuItem id={d.resourceId} key={`${idx}-dx-${d.resourceId}`} value={d.code}>
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
                  <LabsAutocomplete
                    labOrgIdsString={labOrgIdsForSelectedOffice}
                    selectedLab={selectedLab}
                    setSelectedLab={setSelectedLab}
                  ></LabsAutocomplete>
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
                    disabled={isOrderingDisabled}
                    loading={submitting}
                    type="submit"
                    variant="contained"
                    sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}
                  >
                    Order
                  </LoadingButton>
                </Grid>
                {Array.isArray(error) &&
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
