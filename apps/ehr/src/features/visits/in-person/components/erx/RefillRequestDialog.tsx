import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { FC, ReactNode, useState } from 'react';
import { getErxRequest, respondToChange, respondToRenewal } from 'src/api/api';
import { RoundedButton } from 'src/components/RoundedButton';
import { useApiClients } from 'src/hooks/useAppClients';
import { useAuthToken } from 'src/hooks/useAuthToken';
import { getPatientName } from 'src/shared/utils/getPatientName';
import {
  CHANGE_DENIAL_REASONS,
  CHANGE_REQUEST_KINDS,
  ChangeResponseInput,
  RENEWAL_DENIAL_REASONS,
  RENEWAL_PENDING_REASONS,
  RenewalResponseInput,
} from 'utils/lib/types/api/erx.types';
import { formatDateForDisplay } from 'utils/lib/utils/dateUtils';
import { SectionHeading } from '../../../shared/components/NoteSectionHeading';
import { useCancelPrescription } from '../../../shared/hooks/useCancelPrescription';
import { useOrderPrescription } from '../../../shared/hooks/useOrderPrescription';
import { GET_TASKS_KEY, useCompleteErxTask } from '../../hooks/useTasks';
import { OrderPrescriptionForm } from './OrderPrescriptionForm';
import { errorMessage, patientAddressAndPhone, patientNameGenderBirthDate } from './prescriptionDialogs';
import { isPrescriptionCancellable, prescriptionActionUnavailableText } from './prescriptionStatus';
import {
  changeApproval,
  changeResponse,
  refillLine,
  renewalApproval,
  requestRows,
  suggestionText,
} from './refillRequest';

type Answer = 'approve' | 'change' | 'deny' | 'pending';

const ANSWERS: Answer[] = ['approve', 'change', 'deny', 'pending'];

const ANSWER_LABEL: Record<Answer, string> = {
  approve: 'Approve',
  change: 'Change and approve',
  deny: 'Deny',
  pending: 'Pending',
};

/** What a toast says went out, for each answer. */
const SENT_LABEL: Record<Answer, string> = {
  approve: 'Approval',
  change: 'Approval',
  deny: 'Denial',
  pending: 'Pending',
};

const dateTime = (iso: string | undefined): string | undefined =>
  iso ? DateTime.fromISO(iso).toLocal().toFormat('M/d/yyyy h:mm a') : undefined;

/** Label and value rows, as the eRx dialogs list a prescription; a highlighted value differs from the other side. */
const Rows: FC<{ rows: { label: string; value?: ReactNode; highlight?: boolean }[] }> = ({ rows }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: '4px 10px' }}>
    {rows.map((row) => (
      <Box key={row.label} sx={{ display: 'contents' }}>
        <Typography variant="body2" color="text.secondary">
          {row.label}
        </Typography>
        <Typography variant="body2">
          {row.value === undefined ? (
            <Box component="span" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
              Not sent
            </Box>
          ) : (
            <Box
              component="span"
              data-differs={row.highlight || undefined}
              sx={row.highlight ? { bgcolor: 'rgba(237,108,2,.14)', borderRadius: '3px', px: '3px' } : undefined}
            >
              {row.value}
            </Box>
          )}
        </Typography>
      </Box>
    ))}
  </Box>
);

interface RefillRequestDialogProps {
  /** The refill or change request task on the Tasks page */
  taskId: string;
  onClose: () => void;
}

/** A refill or change request, the pharmacy's beside the original prescription, and the provider's answer. */
export const RefillRequestDialog: FC<RefillRequestDialogProps> = ({ taskId, onClose }) => {
  const { oystehrZambda } = useApiClients();
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const { mutateAsync: completeTask } = useCompleteErxTask();
  const { mutateAsync: cancelPrescription } = useCancelPrescription();
  const { mutateAsync: orderPrescription } = useOrderPrescription();
  const [originalCancelled, setOriginalCancelled] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['erx-request', taskId],
    queryFn: () => getErxRequest(oystehrZambda!, { taskId }),
    enabled: !!oystehrZambda,
  });
  const [chosen, setChosen] = useState<Answer>('approve');
  const [fills, setFills] = useState<string>();
  const [suggestion, setSuggestion] = useState(0);
  const [priorAuthorization, setPriorAuthorization] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const respond = useMutation({
    mutationFn: async (body: RenewalResponseInput | ChangeResponseInput) => {
      if (!token) throw new Error('API client not available');
      return change
        ? respondToChange(token, body as ChangeResponseInput)
        : respondToRenewal(token, body as RenewalResponseInput);
    },
  });

  const refill = data?.pharmacyRequest;
  const change = data?.pharmacyChangeRequest;
  const request = refill ?? change;
  const kindName = data?.kind === 'change' ? 'Change' : 'Refill';
  // A prior authorization request is approved with the prior authorization, never with changes.
  const priorAuth = change?.code === 'P';
  const suggestions = change?.suggestions ?? [];
  const selected = suggestions[suggestion];
  // A drug-use alert with no suggestion is approved as written: the eRx service answers Approved with the original.
  const asWritten = change?.code === 'D' && !suggestions.length;
  // Approve sends what the pharmacy asked; a change request with no suggestion has nothing to approve as is.
  const answers = priorAuth
    ? ANSWERS.filter((item) => item !== 'change')
    : change && !suggestions.length && !asWritten
    ? ANSWERS.filter((item) => item !== 'approve')
    : ANSWERS;
  const answer = answers.includes(chosen) ? chosen : answers[0];
  const answerLabel = (key: Answer): string =>
    key === 'approve' && change && !priorAuth
      ? asWritten
        ? 'Approve as written'
        : 'Approve selected'
      : ANSWER_LABEL[key];
  const prescription = data?.prescription;
  const pharmacyName = request?.pharmacy.name ?? 'the pharmacy';
  const contact = patientAddressAndPhone(data?.patient);
  const closed = !!request && (request.withdrawn || request.closed);
  const asked = refill?.medication.requestedRefills;
  const fillsText = fills ?? asked?.toString() ?? '';
  const fillsNumber = Number(fillsText);
  const fillsValid = Number.isInteger(fillsNumber) && fillsNumber >= 1 && fillsNumber <= 99;
  const ready =
    answer !== 'approve' ? reason !== '' : change ? !priorAuth || priorAuthorization.trim() !== '' : fillsValid;

  // Once an answer goes out the dialog closes and a toast says what went out. What went out stays sent when the task
  // can't be completed: it's closed from the Tasks page instead.
  const completeAfterSending = async (sentText: string): Promise<void> => {
    onClose();
    try {
      await completeTask({ taskId });
      enqueueSnackbar(sentText, { variant: 'success' });
    } catch (taskError) {
      console.error(`Error completing the task: ${taskError}`);
      enqueueSnackbar(`${sentText}, but the task couldn’t be closed. Close it from the Tasks page.`, {
        variant: 'warning',
      });
    }
  };

  const send = async (): Promise<void> => {
    if (!request) return;
    const trimmed = note.trim() || undefined;
    if (answer === 'change') return;
    try {
      await respond.mutateAsync(
        change
          ? changeResponse(change.changeTaskId, answer, {
              suggestion: selected ? suggestion : undefined,
              priorAuthorization: priorAuth ? priorAuthorization.trim() : undefined,
              reason,
              note: trimmed,
            })
          : ({
              taskId: refill!.renewalTaskId,
              decision: answer,
              ...(answer === 'approve'
                ? { numberOfRefills: fillsNumber, note: trimmed }
                : { reason, [answer === 'deny' ? 'denialReason' : 'note']: trimmed }),
            } as RenewalResponseInput)
      );
    } catch (sendError) {
      // The dialog stays open, with what was typed, to try again.
      console.error(`Error answering the ${kindName.toLowerCase()} request: ${sendError}`);
      enqueueSnackbar(errorMessage(sendError), { variant: 'error' });
      return;
    }
    const sentText = `${SENT_LABEL[answer]} sent to ${pharmacyName}`;
    // A pending answer keeps the task open, to answer again later: the task list refreshes in the background.
    if (answer === 'pending') {
      onClose();
      enqueueSnackbar(sentText, { variant: 'success' });
      void queryClient.invalidateQueries({ queryKey: [GET_TASKS_KEY], exact: false });
    } else await completeAfterSending(sentText);
  };

  const reasons = answer !== 'deny' ? RENEWAL_PENDING_REASONS : change ? CHANGE_DENIAL_REASONS : RENEWAL_DENIAL_REASONS;
  // The pharmacy's medication the original is compared with: a refill request's, or the selected suggestion.
  const compared = (change ? selected : refill?.medication) ?? {};
  const noteMax = answer === 'deny' ? 210 : 70;

  // A patient's change replaces the original as Send to another pharmacy does, so what blocks that blocks it.
  const changeBlocked =
    !request && data?.kind === 'change' && prescription && !originalCancelled
      ? prescriptionActionUnavailableText('sendToAnotherPharmacy', [prescription])
      : undefined;
  // A new prescription in the order form, saved to the original's visit: the pharmacy's request changed and approved
  // (sent to the pharmacy that asked), or a patient's request (sent as a new prescription, to any pharmacy).
  const showForm = !!data && !!prescription?.encounterId && (request ? answer === 'change' && !closed : !changeBlocked);
  const orderForm = showForm && (
    <OrderPrescriptionForm
      // Picking another suggestion starts the form again from it.
      key={suggestion}
      visit={{ patient: data.patient, encounterId: prescription.encounterId! }}
      initialLine={refillLine(prescription, change ? selected : refill?.medication)}
      {...(request
        ? {
            pharmacy: {
              ncpdpId: request.pharmacy.ncpdpId ?? '',
              npi: request.pharmacy.npi ?? '',
              name: pharmacyName,
              phone: request.pharmacy.phone ?? '',
              address: '',
            },
            onSend: async (line) => {
              await respond.mutateAsync(
                change
                  ? changeApproval(change.changeTaskId, selected ? suggestion : undefined, line)
                  : renewalApproval(refill!.renewalTaskId, line)
              );
            },
            sendLabel: `Send to ${pharmacyName}`,
          }
        : data.kind === 'change'
        ? {
            sendLabel: 'Send prescription',
            // A patient's change: the original is cancelled first, as Send to another pharmacy does, so a
            // cancellation that fails sends nothing and the patient never has two.
            onSend: async (_line, order) => {
              if (!originalCancelled && isPrescriptionCancellable(prescription)) {
                await cancelPrescription({
                  medicationRequestId: prescription.resourceId!,
                  practitionerId: order.practitionerId,
                  reason: 'Prescription/Therapy change',
                });
                setOriginalCancelled(true);
              }
              await orderPrescription(order);
            },
          }
        : { sendLabel: 'Send prescription' })}
      onSent={(sentTo) =>
        void completeAfterSending(`${request ? SENT_LABEL.change : 'Prescription'} sent to ${sentTo.name}`)
      }
    />
  );

  return (
    // One size whatever the answer: the order form's width and the screen's height, the content scrolling inside, so
    // moving between answers doesn't resize it.
    <Dialog
      open
      onClose={respond.isPending ? undefined : onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{ sx: { height: 'calc(100% - 64px)' } }}
    >
      <DialogTitle>
        {request
          ? `${kindName} request from ${pharmacyName}`
          : data
          ? `${kindName} request from ${getPatientName(data.patient.name).firstLastName}`
          : 'Request'}
        {data && (
          <Typography variant="body2" color="text.secondary">
            {patientNameGenderBirthDate(data.patient)}
            {' · '}
            {request
              ? [
                  `Received ${dateTime(request.received)}`,
                  request.askedAgain && `asked again ${dateTime(request.askedAgain)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : `Taken by ${data.patientRequest?.takenBy ?? 'staff'} · ${dateTime(data.patientRequest?.taken)}`}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {isLoading && <CircularProgress size={24} />}
        {error && <Alert severity="error">{errorMessage(error)}</Alert>}
        {data && prescription && (
          <Stack spacing={2}>
            {request?.askedAgain && !closed && (
              <Alert severity="info">
                The pharmacy asked again. You’re answering the newest request ({dateTime(request.askedAgain)}).
              </Alert>
            )}
            {closed && (
              <Alert severity={request.withdrawn ? 'warning' : 'info'}>
                {request.withdrawn ? `${pharmacyName} withdrew this request.` : 'This request is closed.'} It can’t be
                answered.
              </Alert>
            )}
            {change && (
              <Typography>
                <b>{CHANGE_REQUEST_KINDS[change.code] ?? change.code}.</b>
                {change.reason && ` “${change.reason}”`}
                {change.subCodes.length > 0 && ` (sub-codes ${change.subCodes.join(', ')})`}
              </Typography>
            )}
            {data.patientRequest?.note && <Typography>{data.patientRequest.note}</Typography>}
            {(contact.address || contact.phone) && (
              <Box>
                <SectionHeading>Patient Info</SectionHeading>
                <Rows
                  rows={[
                    { label: 'Address', value: contact.address },
                    { label: 'Phone', value: contact.phone },
                  ].filter((row) => row.value)}
                />
              </Box>
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.25fr 1fr' }, gap: 2 }}>
              {suggestions.length > 0 && (
                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                  <SectionHeading>Pharmacy’s suggestions</SectionHeading>
                  <RadioGroup value={suggestion} onChange={(_e, value) => setSuggestion(Number(value))}>
                    {suggestions.map((item, index) => (
                      <FormControlLabel
                        key={index}
                        value={index}
                        disabled={closed}
                        control={<Radio size="small" />}
                        label={
                          <Box>
                            <Typography variant="body2">{item.description}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {suggestionText(item)}
                            </Typography>
                          </Box>
                        }
                      />
                    ))}
                  </RadioGroup>
                </Box>
              )}
              {refill && (
                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                  <SectionHeading>Pharmacy’s request</SectionHeading>
                  <Rows
                    rows={requestRows(refill.medication, prescription).map((row) => ({
                      label: row.label,
                      value:
                        row.label === 'Refills' && asked !== undefined
                          ? `Pharmacy asks for ${asked} ${asked === 1 ? 'fill' : 'fills'}`
                          : row.request,
                      highlight: row.differs,
                    }))}
                  />
                </Box>
              )}
              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: '#F3F6FA' }}>
                <SectionHeading>Original prescription · {formatDateForDisplay(prescription.sent)}</SectionHeading>
                <Rows
                  rows={[
                    ...requestRows(compared, prescription).map((row) => ({
                      label: row.label,
                      value: row.original,
                      highlight: row.differs,
                    })),
                    {
                      label: 'Diagnosis',
                      value: prescription.order?.diagnosisCode
                        ? `${prescription.order.diagnosisDescription ?? ''} (${prescription.order.diagnosisCode})`
                        : undefined,
                    },
                    {
                      label: 'Prescribed',
                      value: [formatDateForDisplay(prescription.sent), data.prescriberName].filter(Boolean).join(' · '),
                    },
                  ].filter((row) => row.value !== undefined)}
                />
              </Box>
            </Box>
            {changeBlocked && <Alert severity="warning">{changeBlocked}</Alert>}
            {!request && orderForm}
            {request && (
              <Stack spacing={2}>
                <SectionHeading>Your answer</SectionHeading>
                <ToggleButtonGroup
                  exclusive
                  color="primary"
                  size="small"
                  value={answer}
                  disabled={closed}
                  onChange={(_e, next: Answer | null) => {
                    if (!next) return;
                    setChosen(next);
                    setReason('');
                    setNote('');
                  }}
                >
                  {answers.map((key) => (
                    <ToggleButton key={key} value={key} sx={{ textTransform: 'none' }}>
                      {answerLabel(key)}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                {orderForm}
                {!closed && answer === 'approve' && priorAuth && (
                  <TextField
                    label="Prior authorization number"
                    required
                    value={priorAuthorization}
                    onChange={(event) => setPriorAuthorization(event.target.value)}
                    inputProps={{ maxLength: 35 }}
                    sx={{ maxWidth: 320 }}
                  />
                )}
                {!closed && answer === 'approve' && refill && (
                  <TextField
                    label="Fills to authorize"
                    value={fillsText}
                    onChange={(event) => setFills(event.target.value)}
                    error={fillsText !== '' && !fillsValid}
                    helperText={
                      fillsValid
                        ? `The pharmacy may fill it ${fillsNumber} more ${fillsNumber === 1 ? 'time' : 'times'}.`
                        : 'A whole number from 1 to 99.'
                    }
                    inputProps={{ inputMode: 'numeric' }}
                    sx={{ maxWidth: 240 }}
                  />
                )}
                {!closed && (answer === 'deny' || answer === 'pending') && (
                  <TextField
                    select
                    label="Reason"
                    required
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  >
                    {reasons.map((item) => (
                      <MenuItem key={item} value={item}>
                        {item}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                {!closed && answer !== 'change' && (
                  <TextField
                    label="Note to pharmacy (optional)"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    inputProps={{ maxLength: noteMax }}
                    helperText={`Up to ${noteMax} characters`}
                  />
                )}
                {!closed && answer === 'approve' && refill && (
                  <Typography variant="body2" color="text.secondary">
                    Sent as “Approved”. If you change the number of fills, it’s sent as “Approved with changes”.
                  </Typography>
                )}
                {!closed && answer === 'approve' && selected && (
                  <Typography variant="body2" color="text.secondary">
                    Sent as “Approved” with {selected.description} exactly as the pharmacy suggested. “Change and
                    approve” opens the order form with it filled in.
                  </Typography>
                )}
                {!closed && answer === 'pending' && (
                  <Typography variant="body2" color="text.secondary">
                    Tells {pharmacyName} you’ll answer later. The task stays open, In progress.
                  </Typography>
                )}
              </Stack>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <RoundedButton onClick={onClose} disabled={respond.isPending}>
          {closed ? 'Close' : 'Cancel'}
        </RoundedButton>
        {request && !closed && answer !== 'change' && (
          <RoundedButton variant="contained" disabled={!ready} loading={respond.isPending} onClick={() => void send()}>
            {answer === 'deny' ? 'Send denial' : `Send to ${pharmacyName}`}
          </RoundedButton>
        )}
      </DialogActions>
    </Dialog>
  );
};
