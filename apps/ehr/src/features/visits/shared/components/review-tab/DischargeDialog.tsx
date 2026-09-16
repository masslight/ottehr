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
  patientInstructions: boolean;
  progressNote: boolean;
  signProgressNote: boolean;
  requireSupervisorApproval: boolean;
}

// The documents a discharge nearly always needs are opt-out; the rest, and signing, are opt-in.
// Patient instructions are already carried inside the discharge summary, so the standalone sheet is
// an extra a provider asks for rather than something to print by default.
const DEFAULT_SELECTIONS: DischargeSelections = {
  dischargeSummary: true,
  workNote: true,
  schoolNote: true,
  patientInstructions: false,
  progressNote: false,
  signProgressNote: false,
  requireSupervisorApproval: true,
};

/** ["a", "b", "c"] -> "a, b & c". Used for the action label and for naming documents in messages. */
const joinWithAmpersand = (parts: string[]): string =>
  parts.length > 1 ? `${parts.slice(0, -1).join(', ')} & ${parts[parts.length - 1]}` : parts[0];

/**
 * Awaits a print-time PDF render and opens it. Rejects on failure so the caller aborts before
 * discharging — a document the provider asked for must not be quietly dropped.
 */
const openGeneratedPdf = async (render: () => Promise<{ presignedURL: string }>): Promise<void> => {
  const { presignedURL } = await render();
  window.open(presignedURL, '_blank');
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
  // Every appointment-scoped document is rendered on demand from the visit, so the appointment is
  // the only thing they need to exist.
  const hasAppointment = Boolean(appointmentId);
  const hasPatientInstructions = (chartData?.instructions?.length ?? 0) > 0;

  const [selections, setSelections] = useState<DischargeSelections>(DEFAULT_SELECTIONS);
  const [isDischarging, setIsDischarging] = useState(false);

  // A failure part-way through leaves the dialog open on its completed steps, and the obvious
  // response is to press the button again. Without this, that retry would regenerate the discharge
  // summary, reopen tabs and re-issue a discharge that already succeeded. Keyed per document so
  // newly ticked boxes still print on the second attempt.
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

  const printDischargeSummary = selections.dischargeSummary && hasAppointment;
  const printWorkNote = selections.workNote && hasWorkNote;
  const printSchoolNote = selections.schoolNote && hasSchoolNote;
  const printPatientInstructions = selections.patientInstructions && hasAppointment && hasPatientInstructions;
  const printProgressNote = selections.progressNote && hasAppointment;
  const signProgressNote = selections.signProgressNote && canSign;
  const requireSupervisorApproval = signProgressNote && selections.requireSupervisorApproval;
  const isPrinting =
    printDischargeSummary || printWorkNote || printSchoolNote || printPatientInstructions || printProgressNote;

  // A selected note whose presigned URL has not arrived yet cannot be opened. Discharging anyway
  // would strand it: once the visit is discharged, DischargeButton drops the dropdown entirely, so
  // this dialog can never be reopened to print it.
  const pendingWorkNote = printWorkNote && !workNoteUrl;
  const pendingSchoolNote = printSchoolNote && !schoolNoteUrl;
  const pendingDocuments = useMemo(
    () => [...(pendingWorkNote ? ['work note'] : []), ...(pendingSchoolNote ? ['school note'] : [])],
    [pendingWorkNote, pendingSchoolNote]
  );

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

    // The confirm button is disabled on this same condition, so in practice this cannot be reached.
    // Kept because the rule — never discharge past a document that was asked for and cannot be
    // produced — belongs with the workflow rather than living only in a button's props.
    if (pendingDocuments.length > 0) {
      enqueueSnackbar(
        `Still preparing the ${joinWithAmpersand(
          pendingDocuments
        )}. Wait a moment, or clear it to discharge without printing it.`,
        { variant: 'warning' }
      );
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

      const excusesToOpen: { key: 'workNote' | 'schoolNote'; url: string }[] = [];

      if (printWorkNote && workNoteUrl && !completedSteps.current.workNote) {
        excusesToOpen.push({ key: 'workNote', url: workNoteUrl });
      }

      if (printSchoolNote && schoolNoteUrl && !completedSteps.current.schoolNote) {
        excusesToOpen.push({ key: 'schoolNote', url: schoolNoteUrl });
      }

      // Rendered on demand and handed back as a presigned URL, so unlike the excuse notes these
      // cannot be opened until the round trip completes. A failure rejects, which aborts before the
      // discharge — the same rule the unready excuse notes follow.
      if (printPatientInstructions && appointmentId && !completedSteps.current.patientInstructions) {
        completedSteps.current.patientInstructions = true;
        printPromises.push(openGeneratedPdf(() => makePatientInstructionsPdf(oystehrZambda, { appointmentId })));
      }

      if (printProgressNote && appointmentId && !completedSteps.current.progressNote) {
        completedSteps.current.progressNote = true;
        printPromises.push(openGeneratedPdf(() => makeProgressNotePdf(oystehrZambda, { appointmentId })));
      }

      // Opened synchronously, before the first await, so the browser still attributes the new tabs
      // to the click that started this and does not block them as popups.
      for (const { key, url } of excusesToOpen) {
        window.open(url, '_blank');
        completedSteps.current[key] = true;
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
      // CustomDialog owns its own title/content/actions spacing, which double-insets each row on top
      // of the paper's padding and leaves the title no larger than the headings inside it. Restyled
      // from the outside via MUI's exported class constants rather than hand-written
      // ".MuiDialogContent-root" strings, so a MUI rename breaks the build instead of the layout.
      // Scoped to this dialog: the other fourteen CustomDialog callers are untouched.
      sx={(theme) => ({
        [`& .${dialogTitleClasses.root}`]: { px: 1, fontSize: theme.typography.h4.fontSize },
        [`& .${dialogContentClasses.root}`]: { pt: 0, px: 1 },
        [`& .${dialogActionsClasses.root}`]: { justifyContent: 'space-between', px: 1 },
        // Close button: MUI's default 'medium' is a ~40px target. `subtitle1` is 20px, which is what
        // MUI's own fontSizeSmall resolves to. Keyed off the title so content icons are unaffected.
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
                disabled={!hasWorkNote}
                onChange={(checked) => select({ workNote: checked })}
                dataTestId={dataTestIds.dischargeDialog.printWorkNoteCheckbox}
                hint={pendingWorkNote ? 'Preparing…' : undefined}
              />
              <SelectionCheckbox
                label="School Note"
                checked={printSchoolNote}
                disabled={!hasSchoolNote}
                onChange={(checked) => select({ schoolNote: checked })}
                dataTestId={dataTestIds.dischargeDialog.printSchoolNoteCheckbox}
                hint={pendingSchoolNote ? 'Preparing…' : undefined}
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
