import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { ClearIcon } from '@mui/x-date-pickers';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import DetailPageContainer from 'src/features/common/DetailPageContainer';
import { getRadiologyUrl } from 'src/features/visits/in-person/routing/helpers';
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
  LATERALITY_SELECTORS,
  LateralityValue,
  RadiologyQuickPickData,
  radiologyStudiesConfig,
  RoleType,
} from 'utils';
import {
  createRadiologyOrder,
  createRadiologyQuickPick,
  getRadiologyQuickPicks,
  updateRadiologyQuickPick,
} from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import useEvolveUser from '../../../hooks/useEvolveUser';
import { useMergedRadiologyQuickPicks } from '../../../hooks/useMergedQuickPicks';
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
  const { encounter, appointment } = useAppointmentData();
  const { chartData, setPartialChartData } = useChartData();
  const { diagnosis } = chartData || {};
  const primaryDiagnosis = diagnosis?.find((d) => d.isPrimary);
  const [orderDx, setOrderDx] = useState<DiagnosisDTO | undefined>(primaryDiagnosis ? primaryDiagnosis : undefined);
  const [orderCpt, setOrderCpt] = useState<CPTCodeDTO | undefined>();
  const [stat, setStat] = useState<boolean>(false);
  const [studyName, setStudyName] = useState<string | undefined>();
  const [clinicalHistory, setClinicalHistory] = useState<string | undefined>();
  const [laterality, setLaterality] = useState<LateralityValue | ''>('');
  const [consentObtained, setConsentObtained] = useState<boolean>(false);

  // Quick picks state
  const { quickPicks: mergedQuickPicks, refetch: refetchQuickPicks } = useMergedRadiologyQuickPicks();
  const [quickPickDialogOpen, setQuickPickDialogOpen] = useState(false);
  const [quickPickName, setQuickPickName] = useState('');
  const [existingQuickPicks, setExistingQuickPicks] = useState<RadiologyQuickPickData[]>([]);
  const [quickPickSaving, setQuickPickSaving] = useState(false);
  const [overwriteTarget, setOverwriteTarget] = useState<RadiologyQuickPickData | null>(null);
  const [confirmOverwriteOpen, setConfirmOverwriteOpen] = useState(false);
  const currentUser = useEvolveUser();
  const isAdmin = currentUser?.hasRole([RoleType.Administrator, RoleType.CustomerSupport]) ?? false;

  const cptCodes = chartData?.cptCodes || [];

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
  const { isFetching: isSearchingCpt, data: cptData } = useGetCPTHCPCSSearch({
    search: cptDebouncedSearchTerm,
    type: 'cpt',
    radiologyOnly: true, // Only fetch CPT codes related to radiology
  });
  const cptSearchOptions = cptData?.codes || radiologyStudiesConfig;
  const { debounce } = useDebounce(800);
  const debouncedCptHandleInputChange = (data: string): void => {
    debounce(() => {
      setCptDebouncedSearchTerm(data);
    });
  };

  // Quick pick handlers
  const onQuickPickSelect = (quickPick: RadiologyQuickPickData): void => {
    if (quickPick.cptCode && quickPick.cptDisplay) {
      setOrderCpt({ code: quickPick.cptCode, display: quickPick.cptDisplay });
    }
    if (quickPick.studyName != null) setStudyName(quickPick.studyName);
    if (quickPick.laterality) setLaterality(quickPick.laterality as LateralityValue);
    if (quickPick.clinicalHistory != null) setClinicalHistory(quickPick.clinicalHistory);
    if (quickPick.stat != null) setStat(quickPick.stat);
    if (quickPick.consentObtained != null) setConsentObtained(quickPick.consentObtained);
  };

  const openQuickPickDialog = async (): Promise<void> => {
    if (!oystehrZambda) return;
    try {
      const response = await getRadiologyQuickPicks(oystehrZambda);
      setExistingQuickPicks(response.quickPicks);
    } catch (error) {
      console.error('Failed to load existing quick picks:', error);
      setExistingQuickPicks(mergedQuickPicks);
    }
    // Suggest name: Study Name | Study Type | Laterality
    const parts: string[] = [];
    if (studyName) parts.push(studyName);
    if (orderCpt) parts.push(orderCpt.display);
    if (laterality) parts.push(LATERALITY_SELECTORS[laterality].uiDisplay);
    setQuickPickName(parts.join(' | '));
    setOverwriteTarget(null);
    setQuickPickDialogOpen(true);
  };

  const buildQuickPickFromCurrentState = (): Omit<RadiologyQuickPickData, 'id'> => ({
    name: quickPickName.trim(),
    cptCode: orderCpt?.code,
    cptDisplay: orderCpt?.display,
    studyName,
    laterality: laterality || undefined,
    clinicalHistory,
    stat,
    consentObtained,
  });

  const onSaveAsQuickPick = async (overwriteId?: string): Promise<void> => {
    if (!quickPickName.trim()) {
      enqueueSnackbar('Quick pick name is required', { variant: 'error' });
      return;
    }
    if (!oystehrZambda) return;

    setQuickPickSaving(true);
    try {
      const quickPickData = buildQuickPickFromCurrentState();
      if (overwriteId) {
        await updateRadiologyQuickPick(oystehrZambda, overwriteId, quickPickData);
        enqueueSnackbar(`Quick pick "${quickPickName}" updated`, { variant: 'success' });
      } else {
        await createRadiologyQuickPick(oystehrZambda, { quickPick: quickPickData });
        enqueueSnackbar(`Quick pick "${quickPickName}" created`, { variant: 'success' });
      }
      setQuickPickDialogOpen(false);
      void refetchQuickPicks();
    } catch (error) {
      console.error('Failed to save quick pick:', error);
      enqueueSnackbar('Failed to save quick pick', { variant: 'error' });
    } finally {
      setQuickPickSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    const lateralityModifier =
      laterality !== ''
        ? { display: LATERALITY_SELECTORS[laterality].modifierDescription, code: laterality }
        : undefined;

    const paramsSatisfied = orderDx && orderCpt && encounter.id && clinicalHistory && clinicalHistory.length <= 255;

    if (oystehrZambda && paramsSatisfied && encounter.id) {
      try {
        await addAdditionalDxToEncounter();
        const res = await createRadiologyOrder(oystehrZambda, {
          diagnosisCode: orderDx.code,
          cptCode: orderCpt.code,
          lateralityModifier,
          encounterId: encounter.id,
          stat: stat,
          clinicalHistory: clinicalHistory,
          studyName: studyName || undefined,
          consentObtained,
        });

        if (res.cptCodesSaved && res.cptCodesSaved?.length > 0) {
          // setting the new cpt codes so they are they when you nav to the assessment page without a refresh
          setPartialChartData({
            cptCodes: [...cptCodes, ...res.cptCodesSaved],
          });
        }

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

  const [consentExists, setConsentExists] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/consent_radiology.pdf', { method: 'HEAD', signal: controller.signal })
      .then((res) => {
        const contentType = res.headers.get('content-type');
        setConsentExists(res.ok && (contentType?.includes('application/pdf') ?? false));
      })
      .catch(() => {
        setConsentExists(false);
      });
    return () => {
      controller.abort();
    };
  }, []);

  return (
    <DetailPageContainer>
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
                  <QuickPicksButton
                    quickPicks={[...mergedQuickPicks].sort((a, b) => a.name.localeCompare(b.name))}
                    getLabel={(qp) => {
                      const parts = [qp.name] as string[];
                      if (qp.cptCode) parts.push(qp.cptCode);
                      return parts.join(' — ');
                    }}
                    onSelect={onQuickPickSelect}
                    disabled={submitting}
                    showAddOption
                    isAdmin={isAdmin}
                    onAddOrUpdate={() => void openQuickPickDialog()}
                    searchable
                  />
                </Grid>
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
                  <FormControl fullWidth>
                    <InputLabel size="small" id="laterality-selector-label">
                      Laterality Selector
                    </InputLabel>
                    <Select
                      size="small"
                      labelId="laterality-selector-label"
                      label="Laterality Selector"
                      id="laterality-selector"
                      onChange={(e) => setLaterality(e.target.value as LateralityValue)}
                      value={laterality}
                      input={
                        <OutlinedInput
                          label="Laterality Selector"
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
                  <Box style={{ display: 'flex', alignItems: 'center' }}>
                    <Checkbox checked={consentObtained} onChange={() => setConsentObtained(!consentObtained)} />
                    <Typography>
                      I have obtained the{' '}
                      {consentExists ? (
                        <Link
                          target="_blank"
                          to={`/consent_radiology.pdf`}
                          style={{ color: theme.palette.primary.main }}
                          rel="noopener noreferrer"
                        >
                          consent for X-ray
                        </Link>
                      ) : (
                        'consent for X-ray'
                      )}
                    </Typography>
                  </Box>
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
                    data-testid={dataTestIds.radiologyPage.submitOrderButton}
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

      {/* Save as Quick Pick dialog */}
      <Dialog open={quickPickDialogOpen} onClose={() => setQuickPickDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{
            color: 'primary.dark',
            fontWeight: 600,
          }}
        >
          Add to Quick Picks
        </DialogTitle>
        <DialogContent>
          <Autocomplete
            freeSolo
            options={existingQuickPicks.map((qp) => qp.name)}
            value={quickPickName}
            onChange={(_e, newValue) => setQuickPickName(newValue ?? '')}
            onInputChange={(_e, newInputValue) => setQuickPickName(newInputValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Quick Pick Name"
                fullWidth
                sx={{ mt: 1 }}
                autoFocus
                placeholder="Enter a name or select an existing quick pick"
              />
            )}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            onClick={() => setQuickPickDialogOpen(false)}
            disabled={quickPickSaving}
            sx={{ borderRadius: 25, textTransform: 'none', fontWeight: 'bold' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!quickPickName.trim() || quickPickSaving}
            sx={{ borderRadius: 25, textTransform: 'none', fontWeight: 'bold' }}
            onClick={() => {
              const existing = existingQuickPicks.find(
                (qp) => qp.name.toLowerCase() === quickPickName.trim().toLowerCase()
              );
              if (existing?.id) {
                setOverwriteTarget(existing);
                setConfirmOverwriteOpen(true);
              } else {
                void onSaveAsQuickPick();
              }
            }}
          >
            {quickPickSaving ? <CircularProgress size={20} /> : 'Save Quick Pick'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Overwrite confirmation dialog */}
      <Dialog open={confirmOverwriteOpen} onClose={() => setConfirmOverwriteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: 'primary.dark', fontWeight: 600 }}>Update Existing Quick Pick?</DialogTitle>
        <DialogContent>
          <Typography>
            A quick pick named "{overwriteTarget?.name}" already exists. Do you want to replace it with the current
            radiology order data?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            onClick={() => setConfirmOverwriteOpen(false)}
            sx={{ borderRadius: 25, textTransform: 'none', fontWeight: 'bold' }}
          >
            Back
          </Button>
          <Button
            variant="contained"
            sx={{ borderRadius: 25, textTransform: 'none', fontWeight: 'bold' }}
            onClick={() => {
              setConfirmOverwriteOpen(false);
              if (overwriteTarget?.id) {
                void onSaveAsQuickPick(overwriteTarget.id);
              }
            }}
          >
            Replace
          </Button>
        </DialogActions>
      </Dialog>
    </DetailPageContainer>
  );
};
