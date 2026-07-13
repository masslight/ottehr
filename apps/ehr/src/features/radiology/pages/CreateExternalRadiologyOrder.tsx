import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { ClearIcon } from '@mui/x-date-pickers';
import React, { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import DetailPageContainer from 'src/features/common/DetailPageContainer';
import { getRadiologyExternalOrderDetailsUrl, getRadiologyUrl } from 'src/features/visits/in-person/routing/helpers';
import { QuickPicksButton } from 'src/features/visits/shared/components/QuickPicksButton';
import {
  useGetCPTHCPCSSearch,
  useICD10SearchNew,
} from 'src/features/visits/shared/stores/appointment/appointment.queries';
import {
  useAppointmentData,
  useChartData,
  useSaveChartData,
} from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import {
  CPTCodeDTO,
  DiagnosisDTO,
  GetRadiologyOrderListZambdaOrder,
  LATERALITY_SELECTORS,
  LateralityValue,
  RADIOLOGY_SAFETY_FLAGS,
  RadiologyPerformingOrganization,
  RadiologyQuickPickData,
  RadiologySafetyFlag,
  radiologyStudiesConfig,
} from 'utils';
import { createRadiologyOrder, updateRadiologyOrder } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import { useMergedRadiologyQuickPicks } from '../../../hooks/useMergedQuickPicks';
import { WithRadiologyBreadcrumbs } from '../components/RadiologyBreadcrumbs';
import { RadiologyOrderLoading } from '../components/RadiologyOrderLoading';
import { usePatientRadiologyOrders } from '../components/usePatientRadiologyOrders';
import { SAFETY_FLAG_LABELS } from '../constants';

interface CreateExternalRadiologyOrderProps {
  /** when provided, the form is in edit mode and submits an update instead of a create */
  initialOrder?: GetRadiologyOrderListZambdaOrder;
}

export const CreateExternalRadiologyOrder: React.FC<CreateExternalRadiologyOrderProps> = ({ initialOrder }) => {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const { id: appointmentIdFromUrl } = useParams();
  const isEditMode = !!initialOrder;
  const [error, setError] = useState<string[] | undefined>(undefined);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const { mutate: saveChartData } = useSaveChartData();
  const { encounter } = useAppointmentData();
  const { chartData, setPartialChartData } = useChartData();
  const { diagnosis } = chartData || {};
  const primaryDiagnosis = diagnosis?.find((d) => d.isPrimary);

  const initialDx: DiagnosisDTO[] = initialOrder?.diagnoses
    ? initialOrder.diagnoses.map((d) => ({ code: d.code, display: d.display }) as DiagnosisDTO)
    : primaryDiagnosis
    ? [primaryDiagnosis]
    : [];

  const [orderDx, setOrderDx] = useState<DiagnosisDTO[]>(initialDx);
  const [orderCpt, setOrderCpt] = useState<CPTCodeDTO | undefined>(
    initialOrder?.cptCode ? { code: initialOrder.cptCode, display: initialOrder.cptCodeDisplay } : undefined
  );
  // Priority/STAT is an in-house-only concept; external orders are routine. Preserve any prior value on edit.
  const stat = initialOrder?.isStat ?? false;
  const [studyName, setStudyName] = useState<string | undefined>(initialOrder?.studyName);
  const [clinicalHistory, setClinicalHistory] = useState<string>(initialOrder?.clinicalHistory ?? '');
  const [laterality, setLaterality] = useState<LateralityValue | ''>(initialOrder?.laterality ?? '');
  // Consent is not part of the external flow (per design/spec); preserve any prior value on edit.
  const consentObtained = initialOrder?.consentObtained ?? false;

  // External-only fields
  const [orgName, setOrgName] = useState<string>(initialOrder?.performingOrganization?.name ?? '');
  const [orgAddress, setOrgAddress] = useState<string>(initialOrder?.performingOrganization?.address ?? '');
  const [orgPhone, setOrgPhone] = useState<string>(initialOrder?.performingOrganization?.phone ?? '');
  const [orgFax, setOrgFax] = useState<string>(initialOrder?.performingOrganization?.fax ?? '');
  const [timeWindow, setTimeWindow] = useState<string>(initialOrder?.timeWindow ?? '');
  const [safetyFlags, setSafetyFlags] = useState<RadiologySafetyFlag[]>(initialOrder?.safetyFlags ?? []);

  const { quickPicks: mergedQuickPicks, loading: mergedQuickPicksLoading } = useMergedRadiologyQuickPicks();
  const cptCodes = chartData?.cptCodes || [];

  const [dxDebouncedSearchTerm, setDxDebouncedSearchTerm] = useState('');
  const { isFetching: isSearchingDx, data: dxData } = useICD10SearchNew({ search: dxDebouncedSearchTerm });
  const icdSearchOptions = dxDebouncedSearchTerm === '' && diagnosis ? diagnosis : dxData?.codes || [];
  const { debounce: debounceDx } = useDebounce(800);
  const debouncedDxHandleInputChange = (data: string): void => {
    debounceDx(() => setDxDebouncedSearchTerm(data));
  };

  const [cptDebouncedSearchTerm, setCptDebouncedSearchTerm] = useState('');
  const { isFetching: isSearchingCpt, data: cptData } = useGetCPTHCPCSSearch({
    search: cptDebouncedSearchTerm,
    type: 'cpt',
    radiologyOnly: true,
  });
  const cptSearchOptions = cptData?.codes || radiologyStudiesConfig;
  const { debounce } = useDebounce(800);
  const debouncedCptHandleInputChange = (data: string): void => {
    debounce(() => setCptDebouncedSearchTerm(data));
  };

  const onQuickPickSelect = (quickPick: RadiologyQuickPickData): void => {
    if (quickPick.cptCode && quickPick.cptDisplay) {
      setOrderCpt({ code: quickPick.cptCode, display: quickPick.cptDisplay });
    } else {
      setOrderCpt(undefined);
    }
    setStudyName(quickPick.studyName ?? '');
    setLaterality((quickPick.laterality as LateralityValue) ?? '');
    setClinicalHistory(quickPick.clinicalHistory ?? '');
  };
  const onQuickPickSelectRef = useRef(onQuickPickSelect);
  onQuickPickSelectRef.current = onQuickPickSelect;

  const toggleSafetyFlag = (flag: RadiologySafetyFlag): void => {
    setSafetyFlags((prev) => (prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag]));
  };

  const addAdditionalDxToEncounter = async (): Promise<void> => {
    if (orderDx.length === 0) return;
    const newDx = orderDx.filter((dx) => !diagnosis?.some((d) => d.code === dx.code));
    if (newDx.length === 0) return;

    await new Promise<void>((resolve, reject) => {
      saveChartData(
        { diagnosis: newDx },
        {
          onSuccess: (data) => {
            const returnedDiagnosis = data.chartData.diagnosis || [];
            const allDx = [...returnedDiagnosis, ...(diagnosis || [])];
            setPartialChartData({ diagnosis: [...allDx] });
            resolve();
          },
          onError: (err) => reject(err),
        }
      );
    });
  };

  const buildPerformingOrganization = (): RadiologyPerformingOrganization | undefined => {
    const org: RadiologyPerformingOrganization = {
      name: orgName.trim() || undefined,
      address: orgAddress.trim() || undefined,
      phone: orgPhone.trim() || undefined,
      fax: orgFax.trim() || undefined,
    };
    return org.name || org.address || org.phone || org.fax ? org : undefined;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    const lateralityModifier =
      laterality !== ''
        ? { display: LATERALITY_SELECTORS[laterality].modifierDescription, code: laterality }
        : undefined;

    const paramsSatisfied = orderDx.length > 0 && orderCpt && encounter.id && clinicalHistory.length <= 255;

    if (oystehrZambda && paramsSatisfied && encounter.id) {
      const sharedFields = {
        diagnosisCodes: orderDx.map((dx) => dx.code),
        cptCode: orderCpt.code,
        lateralityModifier,
        stat,
        clinicalHistory,
        studyName: studyName || undefined,
        consentObtained,
        external: true,
        performingOrganization: buildPerformingOrganization(),
        timeWindow: timeWindow.trim() || undefined,
        safetyFlags: safetyFlags.length > 0 ? safetyFlags : undefined,
      };
      try {
        await addAdditionalDxToEncounter();
        if (isEditMode && initialOrder) {
          await updateRadiologyOrder(oystehrZambda, {
            serviceRequestId: initialOrder.serviceRequestId,
            consentObtained,
            edit: sharedFields,
          });
          navigate(getRadiologyExternalOrderDetailsUrl(appointmentIdFromUrl || '', initialOrder.serviceRequestId));
        } else {
          const res = await createRadiologyOrder(oystehrZambda, { ...sharedFields, encounterId: encounter.id });
          if (res.cptCodesSaved && res.cptCodesSaved.length > 0) {
            setPartialChartData({ cptCodes: [...cptCodes, ...res.cptCodesSaved] });
          }
          navigate(getRadiologyUrl(appointmentIdFromUrl || ''));
        }
      } catch (submitError) {
        console.error('error', JSON.stringify(submitError));
        setError(['There was an error completing the order']);
      }
    } else if (!paramsSatisfied) {
      const errorMessage = [];
      if (orderDx.length === 0) errorMessage.push('Please enter a diagnosis to continue');
      if (!orderCpt) errorMessage.push('Please select a study type (CPT code) to continue');
      if (clinicalHistory.length > 255) errorMessage.push('Clinical history must be 255 characters or less');
      if (errorMessage.length === 0) errorMessage.push('There was an error completing the order');
      setError(errorMessage);
    }
    setSubmitting(false);
  };

  return (
    <DetailPageContainer>
      <WithRadiologyBreadcrumbs sectionName={isEditMode ? 'Edit External Radiology Order' : 'External Radiology Order'}>
        <Stack spacing={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
              {isEditMode ? 'Edit External Radiology Order' : 'External Radiology Order'}
            </Typography>
          </Box>

          <form onSubmit={handleSubmit}>
            <Paper sx={{ p: 3 }}>
              <Grid container sx={{ width: '100%' }} spacing={1} rowSpacing={2}>
                <Grid item xs={12}>
                  <QuickPicksButton
                    quickPicks={mergedQuickPicks}
                    loading={mergedQuickPicksLoading}
                    getLabel={(qp) => {
                      const parts = [qp.name] as string[];
                      if (qp.cptCode) parts.push(qp.cptCode);
                      return parts.join(' — ');
                    }}
                    onSelect={onQuickPickSelect}
                    disabled={submitting}
                    searchable
                  />
                </Grid>

                <Grid item xs={12}>
                  <Autocomplete
                    multiple
                    disableCloseOnSelect
                    id="select-dx"
                    size="small"
                    fullWidth
                    filterOptions={(x) => x}
                    filterSelectedOptions
                    noOptionsText={
                      dxDebouncedSearchTerm && icdSearchOptions.length === 0
                        ? 'Nothing found for this search criteria'
                        : 'Start typing to load results'
                    }
                    value={orderDx}
                    isOptionEqualToValue={(option, value) => value.code === option.code}
                    onChange={(_event: any, selectedDx: any) => setOrderDx(selectedDx)}
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
                  <TextField
                    id="study-name"
                    label="Study Name"
                    placeholder="Enter study name"
                    fullWidth
                    multiline
                    size="small"
                    value={studyName || ''}
                    onChange={(e) => setStudyName(e.target.value)}
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
                    onChange={(_event: any, selectedCpt: any) => setOrderCpt(selectedCpt)}
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
                  <FormControl fullWidth>
                    <InputLabel size="small" id="laterality-selector-label">
                      Laterality
                    </InputLabel>
                    <Select
                      size="small"
                      labelId="laterality-selector-label"
                      label="Laterality"
                      id="laterality-selector"
                      onChange={(e) => setLaterality(e.target.value as LateralityValue)}
                      value={laterality}
                      input={
                        <OutlinedInput
                          label="Laterality"
                          endAdornment={
                            laterality ? (
                              <InputAdornment sx={{ marginRight: '10px' }} position="end">
                                <IconButton aria-label="clear laterality" onClick={() => setLaterality('')}>
                                  <ClearIcon fontSize="small" />
                                </IconButton>
                              </InputAdornment>
                            ) : null
                          }
                        />
                      }
                    >
                      {Object.entries(LATERALITY_SELECTORS).map(([selectorKey, selectorDisplay]) => (
                        <MenuItem key={selectorKey} value={selectorKey}>
                          {`${selectorKey} (${selectorDisplay.uiDisplay})`}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    id="clinical-history"
                    label="Clinical History"
                    placeholder="Enter clinical history for the radiology order"
                    fullWidth
                    multiline
                    size="small"
                    InputLabelProps={{ shrink: !!clinicalHistory }}
                    value={clinicalHistory}
                    onChange={(e) => {
                      if (e.target.value.length <= 255) setClinicalHistory(e.target.value);
                    }}
                    error={clinicalHistory.length > 255}
                    helperText={
                      clinicalHistory.length > 255
                        ? 'Clinical history must be 255 characters or less'
                        : `${clinicalHistory.length}/255 characters`
                    }
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary' }}>
                    Select if the patient has…
                  </Typography>
                  <FormGroup>
                    {RADIOLOGY_SAFETY_FLAGS.map((flag) => (
                      <FormControlLabel
                        key={flag}
                        control={
                          <Checkbox checked={safetyFlags.includes(flag)} onChange={() => toggleSafetyFlag(flag)} />
                        }
                        label={SAFETY_FLAG_LABELS[flag]}
                      />
                    ))}
                  </FormGroup>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    id="time-window"
                    label="Time frame"
                    placeholder="e.g. Please perform within 4 hours"
                    fullWidth
                    size="small"
                    value={timeWindow}
                    onChange={(e) => setTimeWindow(e.target.value)}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ color: theme.palette.primary.dark, mt: 1 }}>
                    Performing Organization
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    id="org-name"
                    label="Organization name"
                    fullWidth
                    size="small"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    id="org-address"
                    label="Address"
                    fullWidth
                    size="small"
                    value={orgAddress}
                    onChange={(e) => setOrgAddress(e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    id="org-phone"
                    label="Phone"
                    fullWidth
                    size="small"
                    value={orgPhone}
                    onChange={(e) => setOrgPhone(e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    id="org-fax"
                    label="Fax"
                    fullWidth
                    size="small"
                    value={orgFax}
                    onChange={(e) => setOrgFax(e.target.value)}
                  />
                </Grid>

                <Grid item xs={6}>
                  <Button
                    variant="outlined"
                    sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}
                    onClick={() => navigate(`/in-person/${appointmentIdFromUrl}/radiology`)}
                  >
                    Cancel
                  </Button>
                </Grid>
                <Grid item xs={6} display="flex" justifyContent="flex-end">
                  <LoadingButton
                    data-testid={dataTestIds.radiologyPage.submitOrderButton}
                    loading={submitting}
                    type="submit"
                    variant="contained"
                    sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}
                  >
                    {isEditMode ? 'Save' : 'Order'}
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
        </Stack>
      </WithRadiologyBreadcrumbs>
    </DetailPageContainer>
  );
};

/**
 * Edit-mode entry point: loads the existing external order by serviceRequestId, then renders the
 * shared form pre-filled. Kept separate so the create route never triggers an order fetch.
 */
export const EditExternalRadiologyOrder: React.FC = () => {
  const { serviceRequestID } = useParams();
  const { orders, loading } = usePatientRadiologyOrders({ serviceRequestId: serviceRequestID });
  const order = orders.find((o) => o.serviceRequestId === serviceRequestID);

  if (loading || !order) {
    return <RadiologyOrderLoading />;
  }

  return <CreateExternalRadiologyOrder initialOrder={order} />;
};
