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
  FormControlLabel,
  Grid,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DetailPageContainer from 'src/features/common/DetailPageContainer';
import { getRadiologyUrl } from 'src/features/visits/in-person/routing/helpers';
import { QuickPicksButton } from 'src/features/visits/shared/components/QuickPicksButton';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useCommandPaletteSource } from 'src/hooks/useCommandPaletteSource';
import { usePendingQuickPick } from 'src/hooks/usePendingQuickPick';
import { LATERALITY_SELECTORS, LateralityValue, RadiologyQuickPickData, RoleType } from 'utils';
import {
  createRadiologyOrder,
  createRadiologyQuickPick,
  getRadiologyQuickPicks,
  updateRadiologyQuickPick,
} from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import useEvolveUser from '../../../hooks/useEvolveUser';
import { sortQuickPicks, useMergedRadiologyQuickPicks } from '../../../hooks/useMergedQuickPicks';
import { WithRadiologyBreadcrumbs } from '../components/RadiologyBreadcrumbs';
import {
  RadiologyOrderCoreFields,
  RadiologyOrderFormActions,
  useRadiologyOrderForm,
} from '../components/RadiologyOrderFormShared';
import { useRadiologyConsentExists } from '../components/useRadiologyConsentExists';

interface CreateRadiologyOrdersProps {
  appointmentID?: string;
}

export const CreateRadiologyOrder: React.FC<CreateRadiologyOrdersProps> = () => {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const { id: appointmentIdFromUrl } = useParams();
  const [error, setError] = useState<string[] | undefined>(undefined);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const { encounter } = useAppointmentData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const form = useRadiologyOrderForm();
  const {
    orderDx,
    orderCpt,
    setOrderCpt,
    studyName,
    setStudyName,
    clinicalHistory,
    setClinicalHistory,
    laterality,
    setLaterality,
    lateralityModifier,
    addAdditionalDxToEncounter,
    chartCptCodes,
    setPartialChartData,
  } = form;

  const [stat, setStat] = useState<boolean>(false);
  const [consentObtained, setConsentObtained] = useState<boolean>(false);

  // Quick picks state
  const {
    quickPicks: mergedQuickPicks,
    loading: mergedQuickPicksLoading,
    refetch: refetchQuickPicks,
  } = useMergedRadiologyQuickPicks();
  const [quickPickDialogOpen, setQuickPickDialogOpen] = useState(false);
  const [quickPickName, setQuickPickName] = useState('');
  const [existingQuickPicks, setExistingQuickPicks] = useState<RadiologyQuickPickData[]>([]);
  const [quickPickSaving, setQuickPickSaving] = useState(false);
  const [overwriteTarget, setOverwriteTarget] = useState<RadiologyQuickPickData | null>(null);
  const [confirmOverwriteOpen, setConfirmOverwriteOpen] = useState(false);
  const currentUser = useEvolveUser();
  const isAdmin = currentUser?.hasRole([RoleType.Administrator, RoleType.CustomerSupport]) ?? false;

  // Quick pick handlers
  const onQuickPickSelect = (quickPick: RadiologyQuickPickData): void => {
    if (quickPick.cptCode && quickPick.cptDisplay) {
      setOrderCpt({ code: quickPick.cptCode, display: quickPick.cptDisplay });
    } else {
      setOrderCpt(undefined);
    }
    setStudyName(quickPick.studyName ?? '');
    setLaterality((quickPick.laterality as LateralityValue) ?? '');
    setClinicalHistory(quickPick.clinicalHistory ?? '');
    // stat and consentObtained not applied — encounter-specific
  };

  const onQuickPickSelectRef = useRef(onQuickPickSelect);
  onQuickPickSelectRef.current = onQuickPickSelect;

  const commandPaletteItems = useMemo(
    () =>
      isReadOnly
        ? []
        : mergedQuickPicks.map((quickPick) => ({
            id: `radiology-${quickPick.id ?? quickPick.name}`,
            label: quickPick.name,
            category: 'Order Radiology',
            onSelect: () => onQuickPickSelectRef.current(quickPick),
          })),
    [isReadOnly, mergedQuickPicks]
  );
  useCommandPaletteSource('radiology-quick-picks', commandPaletteItems);

  const handlePendingQuickPick = useCallback(
    (payload: RadiologyQuickPickData) => {
      if (isReadOnly) {
        return;
      }
      onQuickPickSelectRef.current(payload);
    },
    [isReadOnly]
  );
  usePendingQuickPick('radiology', handlePendingQuickPick);

  const openQuickPickDialog = async (): Promise<void> => {
    if (!oystehrZambda) return;
    try {
      const response = await getRadiologyQuickPicks(oystehrZambda);
      setExistingQuickPicks([...response.quickPicks].sort(sortQuickPicks));
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
    clinicalHistory: clinicalHistory || undefined,
    // stat and consentObtained excluded — encounter-specific
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

    const paramsSatisfied =
      orderDx.length > 0 && orderCpt && encounter.id && clinicalHistory && clinicalHistory.length <= 255;

    if (oystehrZambda && paramsSatisfied && encounter.id) {
      try {
        await addAdditionalDxToEncounter();
        const res = await createRadiologyOrder(oystehrZambda, {
          diagnosisCodes: orderDx.map((dx) => dx.code),
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
            cptCodes: [...chartCptCodes, ...res.cptCodesSaved],
          });
        }

        navigate(getRadiologyUrl(appointmentIdFromUrl || ''));
      } catch (e) {
        const error = e as any;
        console.log('error', JSON.stringify(error));
        const errorMessage = ['There was an error completing the order'];
        setError(errorMessage);
      }
    } else if (!paramsSatisfied) {
      const errorMessage = [];
      if (orderDx.length === 0) errorMessage.push('Please enter a diagnosis to continue');
      if (!orderCpt) errorMessage.push('Please select a study type (CPT code) to continue');
      if (!clinicalHistory) errorMessage.push('Please enter clinical history to continue');
      if (clinicalHistory && clinicalHistory.length > 255)
        errorMessage.push('Clinical history must be 255 characters or less');
      if (errorMessage.length === 0) errorMessage.push('There was an error completing the order');
      setError(errorMessage);
    }
    setSubmitting(false);
  };

  const consentExists = useRadiologyConsentExists();

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
                    quickPicks={mergedQuickPicks}
                    loading={mergedQuickPicksLoading}
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
                <RadiologyOrderCoreFields form={form} />
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
                <RadiologyOrderFormActions
                  appointmentId={appointmentIdFromUrl || ''}
                  submitting={submitting}
                  submitLabel="Order"
                  errors={error}
                />
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
