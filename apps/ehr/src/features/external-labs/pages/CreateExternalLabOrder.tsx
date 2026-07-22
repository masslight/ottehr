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
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ActionsList } from 'src/components/ActionsList';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { UnsavedDraftWarning } from 'src/components/UnsavedDraftWarning';
import { dataTestIds } from 'src/constants/data-test-ids';
import DetailPageContainer from 'src/features/common/DetailPageContainer';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useMainEncounterChartData } from 'src/features/visits/shared/hooks/useMainEncounterChartData';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import {
  useGetCreateExternalLabResources,
  useICD10SearchNew,
} from 'src/features/visits/shared/stores/appointment/appointment.queries';
import {
  useAppointmentData,
  useChartData,
  useSaveChartData,
} from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import {
  APIErrorCode,
  CreateLabPaymentMethod,
  DiagnosisDTO,
  getAttendingPractitionerId,
  HL7_NOTE_CHAR_LIMIT,
  LAB_PAYMENT_METHOD_DISPLAY,
  LabPaymentMethod,
  ModifiedOrderingLocation,
  OrderableItemSearchResult,
  PSC_HOLD_LOCALE,
} from 'utils';
import { createExternalLabOrder } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import { useCreateExternalLabStore, useMarkDraftNavigatedAway } from '../../../state/draft-data.store';
import { ExternalSelectedTests } from '../components/create/ExternalSelectedTests';
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

const PAGE_HEADER_TEXT = 'Order External Lab';

export const CreateExternalLabOrder: React.FC<CreateExternalLabOrdersProps> = () => {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const { id: appointmentIdFromUrl } = useParams();
  const [error, setError] = useState<(string | ReactElement)[] | undefined>(undefined);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const apiClient = useOystehrAPIClient();
  const { encounter, patient, location: apptLocation, followUpOriginEncounter: mainEncounter } = useAppointmentData();
  const { chartData, setPartialChartData } = useChartData();
  const { mutate: saveCPTChartData } = useSaveChartData();
  const { visitType } = useGetAppointmentAccessibility();
  const isFollowup = visitType === 'follow-up';
  const { data: mainEncounterChartData } = useMainEncounterChartData(isFollowup);
  const { setDraft, getDraft, clearDraft, hasDraft } = useCreateExternalLabStore();
  useMarkDraftNavigatedAway({ encounterId: encounter.id ?? '', setDraft, hasDraft });

  const diagnosis = useMemo<DiagnosisDTO[]>(
    () => (isFollowup ? mainEncounterChartData?.diagnosis || [] : chartData?.diagnosis || []),
    [mainEncounterChartData?.diagnosis, chartData?.diagnosis, isFollowup]
  );

  const draft = encounter.id ? getDraft(encounter.id) : {};

  const primaryDiagnosis = diagnosis?.find((d) => d.isPrimary);
  const attendingPractitionerId = getAttendingPractitionerId(encounter);
  const patientId = patient?.id || '';
  const formStateDefaults: {
    dx: DiagnosisDTO[];
    orderableItems: OrderableItemSearchResult[];
    orderingLocationId: string;
    selectedPaymentMethod: CreateLabPaymentMethod | '';
    clinicalInfoNote: string | undefined;
    psc: boolean;
  } = {
    dx: primaryDiagnosis ? [primaryDiagnosis] : [],
    orderableItems: [],
    orderingLocationId: apptLocation?.id ?? '',
    selectedPaymentMethod: '',
    clinicalInfoNote: undefined,
    psc: false,
  };
  const [orderDx, setOrderDx] = useState<DiagnosisDTO[]>(() => {
    if (draft.dx) return draft.dx;
    return formStateDefaults.dx;
  });
  const [selectedLabs, setSelectedLabs] = useState<OrderableItemSearchResult[]>(
    draft.orderableItems ?? formStateDefaults.orderableItems
  );
  const [psc, setPsc] = useState<boolean>(draft.psc ?? formStateDefaults.psc);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>(
    draft.orderingLocationId ?? formStateDefaults.orderingLocationId
  );
  const [labOrgIdsForSelectedOffice, setLabOrgIdsForSelectedOffice] = useState<string>('');
  const [isOrderingDisabled, setIsOrderingDisabled] = useState<boolean>(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<CreateLabPaymentMethod | ''>(
    draft.selectedPaymentMethod ?? formStateDefaults.selectedPaymentMethod
  );
  const [showNotesFields, setShowNotesFields] = useState(false);
  const [clinicalInfoNotes, setClinicalInfoNotes] = useState<string | undefined>(
    draft.clinicalInfoNoteByUser ?? formStateDefaults.clinicalInfoNote
  );

  // consolidating into some functions since every time these state setters are called, we also pass the value to the draft store
  const handleOrderingLocationUpdate = useCallback(
    (officeId: string): void => {
      setSelectedOfficeId(officeId);
      if (encounter.id) setDraft(encounter.id, { orderingLocationId: officeId });
    },
    [setSelectedOfficeId, setDraft, encounter.id]
  );

  const handleDxUpdate = (newDx: DiagnosisDTO[]): void => {
    setOrderDx(newDx);
    if (encounter.id) setDraft(encounter.id, { dx: newDx });
  };

  const handlePaymentMethodUpdate = useCallback(
    (paymentMethod: CreateLabPaymentMethod | ''): void => {
      setSelectedPaymentMethod(paymentMethod);
      if (encounter.id) setDraft(encounter.id, { selectedPaymentMethod: paymentMethod ? paymentMethod : undefined });
    },
    [setSelectedPaymentMethod, setDraft, encounter.id]
  );

  const handleTestSelectionUpdate = (selectedLabs: OrderableItemSearchResult[]): void => {
    setSelectedLabs(selectedLabs);
    if (encounter.id) setDraft(encounter.id, { orderableItems: selectedLabs });
  };

  const handlePscUpdate = (psc: boolean): void => {
    setPsc(psc);
    if (encounter.id) setDraft(encounter.id, { psc });
  };

  const handleClinicalInfoUpdate = (note: string | undefined): void => {
    setClinicalInfoNotes(note);
    if (encounter.id) setDraft(encounter.id, { clinicalInfoNoteByUser: note });
  };

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
    encounterId: mainEncounter?.id,
  });

  const coverageInfo = createExternalLabResources?.coverages;
  const hasInsurance = !!(coverageInfo?.length && coverageInfo.length > 0);
  const orderingLocations = createExternalLabResources?.orderingLocations ?? [];
  const orderingLocationIdsStable = (createExternalLabResources?.orderingLocationIds ?? []).join(',');
  const cptCodesToAddPerEncounter = createExternalLabResources?.cptCodesToAddPerEncounter;
  const isWorkersComp = !!createExternalLabResources?.appointmentIsWorkersComp;
  const labSets = createExternalLabResources?.labSets;

  const orderingLocationIdToLocationAndLabOrgIdsMap = useMemo(
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

  const determineInitialPaymentMethod = useCallback((): LabPaymentMethod | undefined => {
    if (!isWorkersComp && !coverageInfo) {
      console.log('coverageInfo is', coverageInfo);
      return;
    }

    let selectedPaymentMethod: undefined | LabPaymentMethod = undefined;
    if (isWorkersComp) {
      selectedPaymentMethod = LabPaymentMethod.WorkersComp;
    } else if (coverageInfo) {
      if (coverageInfo.length > 0) {
        selectedPaymentMethod = LabPaymentMethod.Insurance;
      } else {
        // if no coverage info is returned, self pay
        selectedPaymentMethod = LabPaymentMethod.SelfPay;
      }
    }
    return selectedPaymentMethod;
  }, [isWorkersComp, coverageInfo]);

  const handleClearForm = (): void => {
    if (encounter.id) clearDraft(encounter.id);
    setSelectedOfficeId(formStateDefaults.orderingLocationId);
    setOrderDx(formStateDefaults.dx);
    setSelectedPaymentMethod(determineInitialPaymentMethod() ?? formStateDefaults.selectedPaymentMethod);
    setSelectedLabs(formStateDefaults.orderableItems);
    setPsc(formStateDefaults.psc);
    setClinicalInfoNotes(formStateDefaults.clinicalInfoNote);
  };

  useEffect(() => {
    if (!apptLocation?.id) return;

    if (orderingLocationIdToLocationAndLabOrgIdsMap.has(apptLocation.id) && !selectedOfficeId) {
      setSelectedOfficeId(apptLocation.id);
      console.log('we did the state set');
    }
  }, [apptLocation?.id, selectedOfficeId, orderingLocationIdToLocationAndLabOrgIdsMap, handleOrderingLocationUpdate]);

  useEffect(() => {
    const labOrgIds = orderingLocationIdToLocationAndLabOrgIdsMap.get(selectedOfficeId)?.labOrgIds ?? '';
    console.log(`lab org ids for selectedOfficeId ${selectedOfficeId}`, labOrgIds);
    setLabOrgIdsForSelectedOffice(labOrgIds);
  }, [selectedOfficeId, orderingLocationIdToLocationAndLabOrgIdsMap]);

  useEffect(() => {
    if (!apptLocation && !selectedOfficeId) {
      setError(['Please select an ordering office to continue']);
      setIsOrderingDisabled(true);
    } else if (
      apptLocation &&
      (!selectedOfficeId || !orderingLocationIdToLocationAndLabOrgIdsMap.has(selectedOfficeId))
    ) {
      setError(['Office is not configured to order labs. Please select another office']);
      setIsOrderingDisabled(true);
    } else {
      setError(undefined);
      setIsOrderingDisabled(false);
    }
  }, [apptLocation, selectedOfficeId, orderingLocationIdToLocationAndLabOrgIdsMap]);

  useEffect(() => {
    const initialPaymentMethod = determineInitialPaymentMethod();

    if (draft.selectedPaymentMethod) setSelectedPaymentMethod(draft.selectedPaymentMethod);
    else if (initialPaymentMethod) {
      setSelectedPaymentMethod(initialPaymentMethod);
    }
  }, [determineInitialPaymentMethod, draft]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    const paramsSatisfied =
      orderDx.length &&
      selectedLabs.length &&
      selectedOfficeId &&
      orderingLocationIdToLocationAndLabOrgIdsMap.has(selectedOfficeId) &&
      selectedPaymentMethod !== '';
    if (oystehrZambda && paramsSatisfied && encounter.id) {
      try {
        if (!psc && cptCodesToAddPerEncounter && cptCodesToAddPerEncounter.length > 0) {
          await addAdditionalCptCodesToEncounter();
        }
        await addAdditionalDxToEncounter();
        await createExternalLabOrder(oystehrZambda, {
          dx: orderDx,
          encounter,
          orderableItems: selectedLabs,
          psc,
          orderingLocation: orderingLocationIdToLocationAndLabOrgIdsMap.get(selectedOfficeId)!.location,
          selectedPaymentMethod: selectedPaymentMethod,
          clinicalInfoNoteByUser: clinicalInfoNotes,
        });
        // clear out the zustand store once the lab is created
        clearDraft(encounter.id);
        navigate(`/in-person/${appointmentIdFromUrl}/external-lab-orders`);
      } catch (e) {
        const sdkError = e as Oystehr.OystehrSdkError;
        console.log('error creating external lab order', sdkError.code, sdkError.message);
        const errorMessage = [sdkError.message];
        if (sdkError.code === APIErrorCode.MISSING_WC_INFO_FOR_LABS) {
          setError([
            <>
              Information necessary to submit labs is missing. Please navigate to{' '}
              <Link to={`/visit/${appointmentIdFromUrl}`}>visit details</Link> and complete all Worker's Compensation
              Information.
            </>,
          ]);
        } else if (sdkError.code === 500) {
          setError(['Internal Server Error']);
        } else {
          setError(errorMessage);
        }
      }
    } else if (!paramsSatisfied) {
      const errorMessage = [];
      if (!orderDx.length) errorMessage.push('Please enter at least one dx');
      if (!selectedLabs.length) errorMessage.push('Please select a lab to order');
      if (!attendingPractitionerId) errorMessage.push('No attending practitioner has been assigned to this encounter');
      if (!(selectedOfficeId && orderingLocationIdToLocationAndLabOrgIdsMap.has(selectedOfficeId)))
        errorMessage.push('No office selected, or office is not configured to order labs');
      if (errorMessage.length === 0) errorMessage.push('There was an error creating this external lab order');
      setError(errorMessage);
    }
    setSubmitting(false);
  };

  const addAdditionalDxToEncounter = async (): Promise<void> => {
    if (!apiClient) {
      throw new Error('API client not available');
    }

    if (!mainEncounter?.id) {
      throw new Error('Encounter ID not available');
    }

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
      const data = await apiClient.saveChartData({
        encounterId: mainEncounter?.id,
        diagnosis: dxToAdd,
      });

      const returnedDiagnosis = data?.chartData?.diagnosis || [];
      const currentEncounterDiagnoses = chartData?.diagnosis || [];
      const allDx = [...returnedDiagnosis, ...currentEncounterDiagnoses];
      if (allDx && !isFollowup) {
        setPartialChartData({
          diagnosis: [...allDx],
        });
      }
    }
  };

  const addAdditionalCptCodesToEncounter = async (): Promise<void> => {
    const chartCptCodes = chartData?.cptCodes || [];
    const existingCodes = chartCptCodes.map((cptCode) => cptCode.code);
    // per product each of these codes will only be added once per encounter
    const codesToAdd = cptCodesToAddPerEncounter?.filter((codeToAdd) => !existingCodes.includes(codeToAdd.code));

    if (codesToAdd && codesToAdd.length > 0) {
      saveCPTChartData(
        {
          cptCodes: codesToAdd,
        },
        {
          onSuccess: (data) => {
            const cptCode = data.chartData?.cptCodes?.[0];
            if (cptCode) {
              setPartialChartData({
                cptCodes: [...chartCptCodes, cptCode],
              });
            }
          },
        }
      );
    }
  };

  if (isError || resourceFetchError) {
    return (
      <DetailPageContainer>
        <LabBreadcrumbs sectionName={PAGE_HEADER_TEXT}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
              {PAGE_HEADER_TEXT}
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
      <LabBreadcrumbs sectionName={PAGE_HEADER_TEXT}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
            {PAGE_HEADER_TEXT}
          </Typography>
        </Box>
        {encounter.id && hasDraft(encounter.id) && (
          <UnsavedDraftWarning
            message={
              draft.hasNavigatedAway
                ? 'Your previously entered data has been restored. Click "Clear Form" to start fresh.'
                : 'You have a lab order in progress. Your draft will be saved.'
            }
          />
        )}

        {dataLoading ? (
          <LabOrderLoading />
        ) : (
          <form onSubmit={handleSubmit}>
            <Paper data-testid={dataTestIds.externalLabs.createPg.createExternalLabForm} sx={{ p: 3 }}>
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
                        data-testid={dataTestIds.externalLabs.createPg.orderingOffice}
                        notched
                        fullWidth
                        id="select-office"
                        label="office"
                        onChange={(e) => {
                          console.log('Selected office value', e.target.value);
                          handleOrderingLocationUpdate(e.target.value);
                          if (!e.target.value)
                            enqueueSnackbar('Must select an ordering office', {
                              variant: 'error',
                            });
                          // future TODO: should clear out the selected lab only if the selected lab isn't from the same lab guid as what the location supports
                          handleTestSelectionUpdate([]);
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
                            handleDxUpdate([...orderDx, selectedDx]);
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
                        handleDxUpdate([...orderDx, selectedDx]);
                      } else {
                        enqueueSnackbar('This Dx is already added to the order', {
                          variant: 'error',
                        });
                      }
                    }}
                    loading={isSearching}
                    options={icdSearchOptions}
                    renderOption={(props, option) => (
                      <li {...props} data-testid="dx-option" data-code={option.code} data-display={option.display}>
                        {option.code} {option.display}
                      </li>
                    )}
                    getOptionLabel={(option) =>
                      typeof option === 'string' ? option : `${option.code} ${option.display}`
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        inputProps={{
                          ...params.inputProps,
                          'data-testid': dataTestIds.externalLabs.createPg.additionalDxSelect,
                        }}
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
                    <Box
                      data-testid={dataTestIds.externalLabs.createPg.selectedDxContainer}
                      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
                    >
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
                            onClick={() => {
                              handleDxUpdate(orderDx.filter((dxVal) => dxVal.code !== value.code));
                            }}
                          />
                        )}
                      />
                    </Box>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ fontWeight: '600px', color: theme.palette.primary.dark, mb: '8px' }}>
                    Payment Method
                  </Typography>
                  <Grid container gap={1} sx={{ display: 'flex' }}>
                    <Grid item xs={6} width="100%">
                      <Select
                        data-testid={dataTestIds.externalLabs.createPg.paymentMethod}
                        notched
                        fullWidth
                        id="select-payment-method"
                        onChange={(e) => handlePaymentMethodUpdate(e.target.value as CreateLabPaymentMethod)}
                        displayEmpty
                        value={selectedPaymentMethod}
                        sx={{
                          '& .MuiInputLabel-root': {
                            top: -8,
                          },
                        }}
                        size="small"
                      >
                        {hasInsurance && (
                          <MenuItem id={'payment-method-item-insurance'} value={LabPaymentMethod.Insurance}>
                            {LAB_PAYMENT_METHOD_DISPLAY[LabPaymentMethod.Insurance]}
                          </MenuItem>
                        )}
                        {isWorkersComp && (
                          <MenuItem id={'payment-method-item-workers-comp'} value={LabPaymentMethod.WorkersComp}>
                            {LAB_PAYMENT_METHOD_DISPLAY[LabPaymentMethod.WorkersComp]}
                          </MenuItem>
                        )}
                        <MenuItem id={'payment-method-item-self-pay'} value={LabPaymentMethod.SelfPay}>
                          {LAB_PAYMENT_METHOD_DISPLAY[LabPaymentMethod.SelfPay]}
                        </MenuItem>
                        <MenuItem id={'payment-method-item-client-bill'} value={LabPaymentMethod.ClientBill}>
                          {LAB_PAYMENT_METHOD_DISPLAY[LabPaymentMethod.ClientBill]}
                        </MenuItem>
                      </Select>
                    </Grid>
                    {hasInsurance && selectedPaymentMethod === 'insurance' && (
                      <Grid item xs={12} width="100%">
                        {coverageInfo.map((coverageInfo, idx) => (
                          <Typography key={`coverage-name-${idx}`} variant="body2">
                            {`${coverageInfo.coverageName}${coverageInfo.isPrimary ? ' (primary)' : ''}`}
                          </Typography>
                        ))}
                      </Grid>
                    )}
                  </Grid>
                </Grid>
                <Grid item xs={12}>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: '600px', color: theme.palette.primary.dark, marginBottom: '8px' }}
                  >
                    Lab
                  </Typography>
                  <LabsAutocomplete
                    orderingLocation={{ searchingForAll: false, selectedOrderingLocationId: selectedOfficeId }}
                    labOrgIdsString={labOrgIdsForSelectedOffice}
                    selectedLabs={selectedLabs}
                    setSelectedLabs={handleTestSelectionUpdate}
                    labSets={labSets}
                  ></LabsAutocomplete>
                  {selectedLabs.length > 0 && (
                    <ExternalSelectedTests selectedLabs={selectedLabs} setSelectedLabs={handleTestSelectionUpdate} />
                  )}
                </Grid>
                {showNotesFields && (
                  <Grid item xs={12}>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: '600px', color: theme.palette.primary.dark, marginBottom: '8px' }}
                    >
                      Clinical Info Notes
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      minRows={2}
                      value={clinicalInfoNotes}
                      onChange={(e) => handleClinicalInfoUpdate(e.target.value)}
                      inputProps={{
                        'data-testid': dataTestIds.externalLabs.createPg.clinicalInfoNote,
                        maxLength: HL7_NOTE_CHAR_LIMIT,
                      }}
                      error={!!(clinicalInfoNotes && clinicalInfoNotes?.length >= HL7_NOTE_CHAR_LIMIT)}
                      helperText={
                        clinicalInfoNotes && clinicalInfoNotes?.length >= HL7_NOTE_CHAR_LIMIT
                          ? `You have reached the ${HL7_NOTE_CHAR_LIMIT} character limit`
                          : ''
                      }
                    ></TextField>
                  </Grid>
                )}
                <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <FormControlLabel
                    sx={{ fontSize: '14px' }}
                    control={<Switch checked={psc} onChange={() => handlePscUpdate(!psc)} />}
                    label={<Typography variant="body2">{PSC_HOLD_LOCALE}</Typography>}
                  />
                  <Button
                    data-testid={dataTestIds.externalLabs.createPg.addClinicalInfoNote}
                    sx={{ textTransform: 'none' }}
                    onClick={() => {
                      if (showNotesFields) handleClinicalInfoUpdate(undefined);
                      setShowNotesFields(!showNotesFields);
                    }}
                  >
                    {`${showNotesFields ? 'Remove' : 'Add'} Note`}
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    variant="outlined"
                    sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}
                    onClick={() => {
                      if (encounter.id) clearDraft(encounter.id);
                      navigate(`/in-person/${appointmentIdFromUrl}/external-lab-orders`);
                    }}
                  >
                    Cancel
                  </Button>
                  {encounter.id && hasDraft(encounter.id) && (
                    <Button
                      variant="outlined"
                      sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600, ml: 1 }}
                      onClick={() => {
                        handleClearForm();
                      }}
                    >
                      Clear Form
                    </Button>
                  )}
                </Grid>
                <Grid item xs={6} display="flex" justifyContent="flex-end">
                  <LoadingButton
                    data-testid={dataTestIds.externalLabs.createPg.createExternalLabOrderBtn}
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
                      <Typography sx={{ color: theme.palette.error.main }}>{msg}</Typography>
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
