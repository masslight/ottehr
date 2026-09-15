import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { LoadingButton } from '@mui/lab';
import { Box, Button, Checkbox, FormControlLabel, FormGroup, Stack, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CustomDialog } from 'src/components/dialogs/CustomDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useApiClients } from 'src/hooks/useAppClients';
import { useGetPatientDocs } from 'src/hooks/useGetPatientDocs';
import { useExcusePresignedFiles } from 'src/shared/hooks/useExcusePresignedFiles';
import { SCHOOL_NOTE_CODE, WORK_NOTE_CODE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useProgressNoteSigning } from '../../hooks/useProgressNoteSigning';
import { useAppointmentData, useChartData } from '../../stores/appointment/appointment.store';
import { createAndOpenDischargeSummary, handleDischarge } from './DischargeButton';

// The gaps that stop a note being signed are already itemised on the Progress Note's Missing &
// Warning card, so the dialog points there instead of restating the list in a second place.
const MISSING_INFORMATION_MESSAGE =
  'Signing is disabled because you have missing required information on the Progress Note. Please check the Review & Sign tab / Missing & Warning section for more details.';

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
  signProgressNote: boolean;
  requireSupervisorApproval: boolean;
}

// Printing is opt-out and signing is opt-in, matching what a discharge most often needs.
const DEFAULT_SELECTIONS: DischargeSelections = {
  dischargeSummary: true,
  workNote: true,
  schoolNote: true,
  signProgressNote: false,
  requireSupervisorApproval: true,
};

/** "Discharge" / "Discharge & Print" / "Discharge, Print & Sign" — whichever the selection implies. */
const joinActionLabel = (parts: string[]): string =>
  parts.length > 1 ? `${parts.slice(0, -1).join(', ')} & ${parts[parts.length - 1]}` : parts[0];

/**
 * Opens an excuse note in a new tab, reporting rather than skipping when its presigned URL has not
 * arrived yet. Returns whether it actually opened, so a retry can pick up what was missed.
 */
const openExcuse = (label: string, url: string | undefined): boolean => {
  if (!url) {
    enqueueSnackbar(`The ${label} is still being prepared — please try again in a moment.`, {
      variant: 'warning',
    });
    return false;
  }

  window.open(url, '_blank');
  return true;
};

const SelectionCheckbox: FC<{
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
  dataTestId: string;
}> = ({ label, checked, disabled, onChange, dataTestId }) => (
  <FormControlLabel
    control={
      <Checkbox
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        data-testid={dataTestId}
      />
    }
    label={<Typography color={disabled ? 'text.disabled' : 'text.primary'}>{label}</Typography>}
  />
);

/**
 * Discharge, optionally printing the visit's documents and signing the note on the way out.
 *
 * Mounted only while it is open (see DischargeButton), which both keeps its data subscriptions off
 * the page the rest of the time and gives every use a fresh set of selections.
 */
export const DischargeDialog: FC<DischargeDialogProps> = ({ onClose, encounterId, appointmentId, patientId }) => {
  const { oystehrZambda } = useApiClients();
  const { chartData } = useChartData();
  const { appointmentRefetch } = useAppointmentData();
  const { downloadDocument } = useGetPatientDocs(patientId ?? '');
  const { completed, permissionMessages, readinessMessages, supervisorApprovalApplies, isSigning, signNote } =
    useProgressNoteSigning();

  // Memoised because it is the dependency of the presigning effect inside useExcusePresignedFiles,
  // which sets state on completion — a fresh `[]` each render would restart that effect forever.
  const schoolWorkNotes = useMemo(() => chartData?.schoolWorkNotes ?? [], [chartData?.schoolWorkNotes]);
  const presignedFiles = useExcusePresignedFiles(schoolWorkNotes);

  // Whether a note exists comes from the chart data, which is already loaded when the dialog opens.
  // Its presigned URL arrives a moment later, so gating the checkbox on the URL would show "Work
  // Note" greyed out for the first instants after opening — exactly how it looks for a visit that
  // has no work note at all, which is how a note ends up silently unprinted.
  const hasWorkNote = schoolWorkNotes.some((note) => note.type === WORK_NOTE_CODE);
  const hasSchoolNote = schoolWorkNotes.some((note) => note.type === SCHOOL_NOTE_CODE);
  const workNoteUrl = presignedFiles.find((file) => file.type === WORK_NOTE_CODE)?.presignedUrl;
  const schoolNoteUrl = presignedFiles.find((file) => file.type === SCHOOL_NOTE_CODE)?.presignedUrl;
  const hasDischargeSummary = Boolean(appointmentId);

  const [selections, setSelections] = useState<DischargeSelections>(DEFAULT_SELECTIONS);
  const [isDischarging, setIsDischarging] = useState(false);

  // A failure part-way through leaves the dialog open on its completed steps, and the obvious
  // response is to press the button again. Without this, that retry would regenerate the discharge
  // summary, reopen tabs and re-issue a discharge that already succeeded. Keyed per document so
  // newly ticked boxes still print on the second attempt.
  const completedSteps = useRef({ dischargeSummary: false, workNote: false, schoolNote: false, discharged: false });

  const select = useCallback((patch: Partial<DischargeSelections>): void => {
    setSelections((current) => ({ ...current, ...patch }));
  }, []);

  // The visit-status reasons are deliberately left out: this dialog discharges the patient before it
  // signs, so "you must discharge the patient before signing" is about to stop being true.
  const signDisabledReason = completed
    ? 'This visit has already been signed.'
    : permissionMessages[0] ?? (readinessMessages.length > 0 ? MISSING_INFORMATION_MESSAGE : undefined);
  const canSign = !signDisabledReason;

  // Drop a sign selection that has become impossible rather than leaving the intent stored behind a
  // disabled checkbox; the reason rendered below explains why the option went away.
  useEffect(() => {
    if (!canSign) {
      setSelections((current) => (current.signProgressNote ? { ...current, signProgressNote: false } : current));
    }
  }, [canSign]);

  const printDischargeSummary = selections.dischargeSummary && hasDischargeSummary;
  const printWorkNote = selections.workNote && hasWorkNote;
  const printSchoolNote = selections.schoolNote && hasSchoolNote;
  const signProgressNote = selections.signProgressNote && canSign;
  const requireSupervisorApproval = signProgressNote && selections.requireSupervisorApproval;
  const isPrinting = printDischargeSummary || printWorkNote || printSchoolNote;

  const isLoading = isDischarging || isSigning;

  // The workflow carries on after the dialog unmounts, so dismissing it mid-flight would hide a
  // discharge and a signature that are still running.
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

    setIsDischarging(true);

    try {
      const printPromises: Promise<void>[] = [];

      if (printDischargeSummary && appointmentId && !completedSteps.current.dischargeSummary) {
        // Marked before awaiting: createAndOpenDischargeSummary reports its own failures and never
        // rejects, so a retry re-running it would only supersede the document it just filed.
        completedSteps.current.dischargeSummary = true;
        printPromises.push(
          createAndOpenDischargeSummary(oystehrZambda, appointmentId, downloadDocument, { skipRelated: true })
        );
      }

      // Opened synchronously, before the first await, so the browser still attributes the new tabs
      // to the click that started this and does not block them as popups.
      if (printWorkNote && !completedSteps.current.workNote) {
        completedSteps.current.workNote = openExcuse('work note', workNoteUrl);
      }

      if (printSchoolNote && !completedSteps.current.schoolNote) {
        completedSteps.current.schoolNote = openExcuse('school note', schoolNoteUrl);
      }

      await Promise.all(printPromises);

      if (!completedSteps.current.discharged) {
        await handleDischarge(encounterId, oystehrZambda);
        completedSteps.current.discharged = true;
      }

      if (signProgressNote) {
        // Signing is only permitted once the visit is discharged, and it refreshes the appointment
        // itself, so it both follows the discharge and covers the refetch for it.
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
    signProgressNote,
    requireSupervisorApproval,
    signNote,
    downloadDocument,
    appointmentRefetch,
    onClose,
  ]);

  const actionLabel = joinActionLabel([
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
      description={
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle1" color="primary.dark" fontWeight={600}>
              Print documents
            </Typography>
            <FormGroup>
              <SelectionCheckbox
                label="Discharge Summary + Patient Instructions"
                checked={printDischargeSummary}
                disabled={!hasDischargeSummary}
                onChange={(checked) => select({ dischargeSummary: checked })}
                dataTestId={dataTestIds.dischargeDialog.printDischargeSummaryCheckbox}
              />
              <SelectionCheckbox
                label="Work Note"
                checked={printWorkNote}
                disabled={!hasWorkNote}
                onChange={(checked) => select({ workNote: checked })}
                dataTestId={dataTestIds.dischargeDialog.printWorkNoteCheckbox}
              />
              <SelectionCheckbox
                label="School Note"
                checked={printSchoolNote}
                disabled={!hasSchoolNote}
                onChange={(checked) => select({ schoolNote: checked })}
                dataTestId={dataTestIds.dischargeDialog.printSchoolNoteCheckbox}
              />
            </FormGroup>
          </Box>

          <Box>
            <Typography variant="subtitle1" color="primary.dark" fontWeight={600}>
              Review &amp; Sign
            </Typography>
            <FormGroup>
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
