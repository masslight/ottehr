import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Checkbox,
  dialogActionsClasses,
  dialogContentClasses,
  dialogTitleClasses,
  FormControlLabel,
  FormGroup,
  iconButtonClasses,
  Stack,
  svgIconClasses,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { makePatientInstructionsPdf, makeProgressNotePdf } from 'src/api/api';
import { CustomDialog } from 'src/components/dialogs/CustomDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useApiClients } from 'src/hooks/useAppClients';
import { useGetPatientDocs } from 'src/hooks/useGetPatientDocs';
import { useExcusePresignedFiles } from 'src/shared/hooks/useExcusePresignedFiles';
import { SCHOOL_NOTE_CODE, WORK_NOTE_CODE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useProgressNoteSigning } from '../../hooks/useProgressNoteSigning';
import { useAppointmentData, useChartData } from '../../stores/appointment/appointment.store';
import { createAndOpenDischargeSummary, handleDischarge } from './DischargeButton';

const MISSING_INFORMATION_MESSAGE =
  'Signing is disabled because you have missing required information on the Progress Note. Please check the Review & Sign tab / Missing & Warning section for more details.';

const UNAVAILABLE_HINT = 'Unavailable — print from the chart';
const PREPARING_HINT = 'Preparing…';

const POPUP_BLOCKED_MESSAGE =
  'Your browser blocked the document windows, so nothing was printed and the patient has not been discharged. Allow pop-ups for this site and try again.';

interface DischargeDialogProps {
  onClose: () => void;
  encounterId: string;
  appointmentId?: string;
  patientId?: string;
}

interface DischargeSelections {
  dischargeSummary: boolean;
  workNote: boolean;
  schoolNote: boolean;
  patientInstructions: boolean;
  progressNote: boolean;
  signProgressNote: boolean;
  requireSupervisorApproval: boolean;
}

const DEFAULT_SELECTIONS: DischargeSelections = {
  dischargeSummary: true,
  workNote: true,
  schoolNote: true,
  patientInstructions: false,
  progressNote: false,
  signProgressNote: false,
  requireSupervisorApproval: true,
};

/** ["a", "b", "c"] -> "a, b & c" */
const joinWithAmpersand = (parts: string[]): string =>
  parts.length > 1 ? `${parts.slice(0, -1).join(', ')} & ${parts[parts.length - 1]}` : parts[0];

const openGeneratedPdf = async (tab: Window, render: () => Promise<{ presignedURL: string }>): Promise<void> => {
  try {
    const { presignedURL } = await render();
    tab.location.href = presignedURL;
  } catch (error) {
    tab.close();
    throw error;
  }
};

const SelectionCheckbox: FC<{
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
  dataTestId: string;
  hint?: string;
}> = ({ label, checked, disabled, onChange, dataTestId, hint }) => (
  <FormControlLabel
    control={
      <Checkbox
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        data-testid={dataTestId}
      />
    }
    label={
      <Typography component="span" color={disabled ? 'text.disabled' : 'text.primary'}>
        {label}
        {hint && (
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            {hint}
          </Typography>
        )}
      </Typography>
    }
  />
);

export const DischargeDialog: FC<DischargeDialogProps> = ({ onClose, encounterId, appointmentId, patientId }) => {
  const { oystehrZambda } = useApiClients();
  const { chartData } = useChartData();
  const { appointmentRefetch } = useAppointmentData();
  const { downloadDocument } = useGetPatientDocs(patientId ?? '');
  const { completed, permissionMessages, readinessMessages, supervisorApprovalApplies, isSigning, signNote } =
    useProgressNoteSigning();

  // Stable reference: useExcusePresignedFiles depends on it and sets state on completion.
  const schoolWorkNotes = useMemo(() => chartData?.schoolWorkNotes ?? [], [chartData?.schoolWorkNotes]);
  const presignedFiles = useExcusePresignedFiles(schoolWorkNotes);

  const hasWorkNote = schoolWorkNotes.some((note) => note.type === WORK_NOTE_CODE);
  const hasSchoolNote = schoolWorkNotes.some((note) => note.type === SCHOOL_NOTE_CODE);
  // An entry appears once presigning has settled, without `presignedUrl` if it failed.
  const workNoteFile = presignedFiles.find((file) => file.type === WORK_NOTE_CODE);
  const schoolNoteFile = presignedFiles.find((file) => file.type === SCHOOL_NOTE_CODE);
  const workNoteUrl = workNoteFile?.presignedUrl;
  const schoolNoteUrl = schoolNoteFile?.presignedUrl;
  const workNoteUnavailable = Boolean(workNoteFile && !workNoteUrl);
  const schoolNoteUnavailable = Boolean(schoolNoteFile && !schoolNoteUrl);
  const hasAppointment = Boolean(appointmentId);
  const hasPatientInstructions = chartData?.instructions?.some((instruction) => instruction.text) ?? false;

  const [selections, setSelections] = useState<DischargeSelections>(DEFAULT_SELECTIONS);
  const [isDischarging, setIsDischarging] = useState(false);

  // Keeps a retry after a partial failure from repeating the steps that already succeeded.
  const completedSteps = useRef({
    dischargeSummary: false,
    workNote: false,
    schoolNote: false,
    patientInstructions: false,
    progressNote: false,
    discharged: false,
  });

  const select = useCallback((patch: Partial<DischargeSelections>): void => {
    setSelections((current) => ({ ...current, ...patch }));
  }, []);

  // Visit-status reasons are excluded: this dialog discharges before it signs.
  const signDisabledReason = completed
    ? 'This visit has already been signed.'
    : permissionMessages[0] ?? (readinessMessages.length > 0 ? MISSING_INFORMATION_MESSAGE : undefined);
  const canSign = !signDisabledReason;

  useEffect(() => {
    if (!canSign) {
      setSelections((current) => (current.signProgressNote ? { ...current, signProgressNote: false } : current));
    }
  }, [canSign]);

  const printDischargeSummary = selections.dischargeSummary && hasAppointment;
  const printWorkNote = selections.workNote && hasWorkNote && !workNoteUnavailable;
  const printSchoolNote = selections.schoolNote && hasSchoolNote && !schoolNoteUnavailable;
  const printPatientInstructions = selections.patientInstructions && hasAppointment && hasPatientInstructions;
  const printProgressNote = selections.progressNote && hasAppointment;
  const signProgressNote = selections.signProgressNote && canSign;
  const requireSupervisorApproval = signProgressNote && selections.requireSupervisorApproval;
  const isPrinting =
    printDischargeSummary || printWorkNote || printSchoolNote || printPatientInstructions || printProgressNote;

  const pendingWorkNote = printWorkNote && !workNoteUrl && !workNoteUnavailable;
  const pendingSchoolNote = printSchoolNote && !schoolNoteUrl && !schoolNoteUnavailable;
  const pendingDocuments = useMemo(
    () => [...(pendingWorkNote ? ['work note'] : []), ...(pendingSchoolNote ? ['school note'] : [])],
    [pendingWorkNote, pendingSchoolNote]
  );

  const isLoading = isDischarging || isSigning;

  const handleClose = useCallback((): void => {
    if (isLoading) {
      return;
    }
    onClose();
  }, [isLoading, onClose]);

  const handleConfirm = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) {
      enqueueSnackbar('API client not available. Please try again.', { variant: 'error' });
      return;
    }

    if (pendingDocuments.length > 0) {
      enqueueSnackbar(
        `Still preparing the ${joinWithAmpersand(
          pendingDocuments
        )}. Wait a moment, or clear it to discharge without printing it.`,
        { variant: 'warning' }
      );
      return;
    }

    // Reserved synchronously, while the click still counts as user activation.
    const reservedTabs: Window[] = [];
    const reserveTab = (url: string): Window | null => {
      const tab = window.open(url, '_blank');
      if (tab) {
        reservedTabs.push(tab);
      }
      return tab;
    };

    const excusesToOpen: { key: 'workNote' | 'schoolNote'; tab: Window | null }[] = [];
    if (printWorkNote && workNoteUrl && !completedSteps.current.workNote) {
      excusesToOpen.push({ key: 'workNote', tab: reserveTab(workNoteUrl) });
    }
    if (printSchoolNote && schoolNoteUrl && !completedSteps.current.schoolNote) {
      excusesToOpen.push({ key: 'schoolNote', tab: reserveTab(schoolNoteUrl) });
    }

    const dischargeSummaryTab =
      printDischargeSummary && appointmentId && !completedSteps.current.dischargeSummary ? reserveTab('') : undefined;
    const instructionsTab =
      printPatientInstructions && appointmentId && !completedSteps.current.patientInstructions
        ? reserveTab('')
        : undefined;
    const progressNoteTab =
      printProgressNote && appointmentId && !completedSteps.current.progressNote ? reserveTab('') : undefined;

    const blocked =
      excusesToOpen.some(({ tab }) => !tab) ||
      dischargeSummaryTab === null ||
      instructionsTab === null ||
      progressNoteTab === null;
    if (blocked) {
      reservedTabs.forEach((tab) => tab.close());
      enqueueSnackbar(POPUP_BLOCKED_MESSAGE, { variant: 'error' });
      return;
    }

    for (const { key } of excusesToOpen) {
      completedSteps.current[key] = true;
    }

    setIsDischarging(true);

    try {
      const printPromises: Promise<void>[] = [];

      if (dischargeSummaryTab && appointmentId) {
        printPromises.push(
          createAndOpenDischargeSummary(oystehrZambda, appointmentId, downloadDocument, {
            skipRelated: true,
            targetTab: dischargeSummaryTab,
          }).then((created) => {
            if (!created) {
              throw new Error('The discharge summary could not be created');
            }
            completedSteps.current.dischargeSummary = true;
          })
        );
      }

      if (instructionsTab && appointmentId) {
        printPromises.push(
          openGeneratedPdf(instructionsTab, () => makePatientInstructionsPdf(oystehrZambda, { appointmentId })).then(
            () => {
              completedSteps.current.patientInstructions = true;
            }
          )
        );
      }

      if (progressNoteTab && appointmentId) {
        printPromises.push(
          openGeneratedPdf(progressNoteTab, () => makeProgressNotePdf(oystehrZambda, { appointmentId })).then(() => {
            completedSteps.current.progressNote = true;
          })
        );
      }

      const printResults = await Promise.allSettled(printPromises);
      const failedPrint = printResults.find((result) => result.status === 'rejected');
      if (failedPrint) {
        throw failedPrint.reason;
      }

      if (!completedSteps.current.discharged) {
        await handleDischarge(encounterId, oystehrZambda);
        completedSteps.current.discharged = true;
      }

      if (signProgressNote) {
        // signNote refetches the appointment itself.
        await signNote({ requireSupervisorApproval });
      } else {
        await appointmentRefetch();
      }

      onClose();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
    } finally {
      setIsDischarging(false);
    }
  }, [
    oystehrZambda,
    encounterId,
    appointmentId,
    printDischargeSummary,
    printWorkNote,
    workNoteUrl,
    printSchoolNote,
    schoolNoteUrl,
    printPatientInstructions,
    printProgressNote,
    pendingDocuments,
    signProgressNote,
    requireSupervisorApproval,
    signNote,
    downloadDocument,
    appointmentRefetch,
    onClose,
  ]);

  const actionLabel = joinWithAmpersand([
    'Discharge',
    ...(isPrinting ? ['Print'] : []),
    ...(signProgressNote ? ['Sign'] : []),
  ]);

  return (
    <CustomDialog
      open
      handleClose={handleClose}
      closeButton={!isLoading}
      title="Discharge"
      maxWidth="xs"
      fullWidth
      sx={(theme) => ({
        [`& .${dialogTitleClasses.root}`]: { px: 1, fontSize: theme.typography.h4.fontSize },
        [`& .${dialogContentClasses.root}`]: { pt: 0, px: 1 },
        [`& .${dialogActionsClasses.root}`]: { justifyContent: 'space-between', px: 1 },
        [`& .${dialogTitleClasses.root} .${iconButtonClasses.root}`]: {
          p: 0.5,
          [`& .${svgIconClasses.root}`]: { fontSize: theme.typography.subtitle1.fontSize },
        },
      })}
      description={
        <Stack spacing={1}>
          <Box>
            <Typography variant="h6" color="primary.dark">
              Print documents
            </Typography>
            <FormGroup sx={{ pl: 0.5 }}>
              <SelectionCheckbox
                label="Discharge Summary"
                checked={printDischargeSummary}
                disabled={!hasAppointment}
                onChange={(checked) => select({ dischargeSummary: checked })}
                dataTestId={dataTestIds.dischargeDialog.printDischargeSummaryCheckbox}
              />
              <SelectionCheckbox
                label="Work Note"
                checked={printWorkNote}
                disabled={!hasWorkNote || workNoteUnavailable}
                onChange={(checked) => select({ workNote: checked })}
                dataTestId={dataTestIds.dischargeDialog.printWorkNoteCheckbox}
                hint={workNoteUnavailable ? UNAVAILABLE_HINT : pendingWorkNote ? PREPARING_HINT : undefined}
              />
              <SelectionCheckbox
                label="School Note"
                checked={printSchoolNote}
                disabled={!hasSchoolNote || schoolNoteUnavailable}
                onChange={(checked) => select({ schoolNote: checked })}
                dataTestId={dataTestIds.dischargeDialog.printSchoolNoteCheckbox}
                hint={schoolNoteUnavailable ? UNAVAILABLE_HINT : pendingSchoolNote ? PREPARING_HINT : undefined}
              />
              <SelectionCheckbox
                label="Patient Instructions"
                checked={printPatientInstructions}
                disabled={!hasAppointment || !hasPatientInstructions}
                onChange={(checked) => select({ patientInstructions: checked })}
                dataTestId={dataTestIds.dischargeDialog.printPatientInstructionsCheckbox}
              />
              <SelectionCheckbox
                label="Progress Note"
                checked={printProgressNote}
                disabled={!hasAppointment}
                onChange={(checked) => select({ progressNote: checked })}
                dataTestId={dataTestIds.dischargeDialog.printProgressNoteCheckbox}
              />
            </FormGroup>
          </Box>

          <Box>
            <Typography variant="h6" color="primary.dark">
              Review &amp; Sign
            </Typography>
            <FormGroup sx={{ pl: 0.5 }}>
              <SelectionCheckbox
                label="Sign the Progress Note"
                checked={signProgressNote}
                disabled={!canSign}
                onChange={(checked) => select({ signProgressNote: checked })}
                dataTestId={dataTestIds.dischargeDialog.signProgressNoteCheckbox}
              />
              {supervisorApprovalApplies && (
                <SelectionCheckbox
                  label="Require Supervisor Approval"
                  checked={requireSupervisorApproval}
                  disabled={!signProgressNote}
                  onChange={(checked) => select({ requireSupervisorApproval: checked })}
                  dataTestId={dataTestIds.dischargeDialog.supervisorApprovalCheckbox}
                />
              )}
            </FormGroup>
            {signDisabledReason && (
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <ErrorOutlineIcon color="error" fontSize="small" />
                <Typography
                  variant="body2"
                  color="text.secondary"
                  data-testid={dataTestIds.dischargeDialog.signDisabledReason}
                >
                  {signDisabledReason}
                </Typography>
              </Stack>
            )}
          </Box>
        </Stack>
      }
      actions={
        <>
          <Button
            onClick={handleClose}
            disabled={isLoading}
            variant="outlined"
            sx={{ borderRadius: 100, textTransform: 'none' }}
          >
            Cancel
          </Button>
          <LoadingButton
            onClick={handleConfirm}
            loading={isLoading}
            disabled={pendingDocuments.length > 0}
            variant="contained"
            data-testid={dataTestIds.dischargeDialog.confirmButton}
            sx={{ borderRadius: 100, textTransform: 'none' }}
          >
            {actionLabel}
          </LoadingButton>
        </>
      }
    />
  );
};
