import {
  Alert,
  Box,
  capitalize,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
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
import { getErxRequest, respondToRenewal } from 'src/api/api';
import { RoundedButton } from 'src/components/RoundedButton';
import { useApiClients } from 'src/hooks/useAppClients';
import { useAuthToken } from 'src/hooks/useAuthToken';
import { getPatientName } from 'src/shared/utils/getPatientName';
import { RENEWAL_DENIAL_REASONS, RENEWAL_PENDING_REASONS, RenewalResponseInput } from 'utils/lib/types/api/erx.types';
import { formatDateForDisplay } from 'utils/lib/utils/dateUtils';
import { SectionHeading } from '../../../shared/components/NoteSectionHeading';
import { GET_TASKS_KEY, useCompleteTask } from '../../hooks/useTasks';
import { OrderPrescriptionForm } from './OrderPrescriptionForm';
import { errorMessage, patientAddressAndPhone } from './prescriptionDialogs';
import { plainNumber, refillLine, renewalApproval, requestRows } from './refillRequest';

type Answer = 'approve' | 'change' | 'deny' | 'pending';

const ANSWER_LABEL: Record<Answer, string> = {
  approve: 'Approve',
  change: 'Change and approve',
  deny: 'Deny',
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
  /** The refill request task on the Tasks page */
  taskId: string;
  onClose: () => void;
}

/** A refill request, the pharmacy's beside the original prescription, and the provider's answer. */
export const RefillRequestDialog: FC<RefillRequestDialogProps> = ({ taskId, onClose }) => {
  const { oystehrZambda } = useApiClients();
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const { mutateAsync: completeTask } = useCompleteTask();
  const { data, isLoading, error } = useQuery({
    queryKey: ['erx-request', taskId],
    queryFn: () => getErxRequest(oystehrZambda!, { taskId }),
    enabled: !!oystehrZambda,
  });
  const [answer, setAnswer] = useState<Answer>('approve');
  const [fills, setFills] = useState<string>();
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [sent, setSent] = useState<string>();
  const respond = useMutation({
    mutationFn: async (body: RenewalResponseInput) => {
      if (!token) throw new Error('API client not available');
      return respondToRenewal(token, body);
    },
  });

  const request = data?.pharmacyRequest;
  const prescription = data?.prescription;
  const pharmacyName = request?.pharmacy.name ?? 'the pharmacy';
  const contact = patientAddressAndPhone(data?.patient);
  const closed = !!request && (request.withdrawn || request.closed);
  const fillsText = fills ?? plainNumber(request?.medication.requestedRefills) ?? '';
  const fillsNumber = Number(fillsText);
  const fillsValid = Number.isInteger(fillsNumber) && fillsNumber >= 1 && fillsNumber <= 99;
  const ready = answer === 'approve' ? fillsValid : reason !== '';

  const send = async (): Promise<void> => {
    if (!request) return;
    const trimmed = note.trim() || undefined;
    const body: RenewalResponseInput =
      answer === 'approve'
        ? { taskId: request.renewalTaskId, decision: 'approve', numberOfRefills: fillsNumber, note: trimmed }
        : answer === 'deny'
        ? {
            taskId: request.renewalTaskId,
            decision: 'deny',
            reason: reason as (typeof RENEWAL_DENIAL_REASONS)[number],
            denialReason: trimmed,
          }
        : {
            taskId: request.renewalTaskId,
            decision: 'pending',
            reason: reason as (typeof RENEWAL_PENDING_REASONS)[number],
            note: trimmed,
          };
    try {
      await respond.mutateAsync(body);
    } catch (sendError) {
      console.error(`Error answering the refill request: ${sendError}`);
      enqueueSnackbar(errorMessage(sendError), { variant: 'error' });
      return;
    }
    // A pending answer keeps the task open, to answer again later.
    if (answer === 'pending') await queryClient.invalidateQueries({ queryKey: [GET_TASKS_KEY], exact: false });
    else await completeTask({ taskId });
    setSent(
      answer === 'approve'
        ? `Approved: ${fillsNumber} ${fillsNumber === 1 ? 'fill' : 'fills'}. Sent to ${pharmacyName}.`
        : `${ANSWER_LABEL[answer]}: ${reason}. Sent to ${pharmacyName}.`
    );
  };

  const reasons = answer === 'deny' ? RENEWAL_DENIAL_REASONS : RENEWAL_PENDING_REASONS;

  // A new prescription in the order form, saved to the original's visit: the pharmacy's request changed and approved
  // (sent to the pharmacy that asked), or a patient's request (sent as a new prescription, to any pharmacy).
  const showForm = !!data && !!prescription?.encounterId && !sent && (request ? answer === 'change' && !closed : true);
  const orderForm = showForm && (
    <OrderPrescriptionForm
      visit={{ patient: data.patient, encounterId: prescription.encounterId! }}
      initialLine={refillLine(prescription, request?.medication)}
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
              await respond.mutateAsync(renewalApproval(request.renewalTaskId, line));
            },
            sendLabel: `Send to ${pharmacyName}`,
          }
        : { sendLabel: 'Send prescription' })}
      onSent={() => {
        void completeTask({ taskId });
        setSent(request ? `Approved with your changes. Sent to ${pharmacyName}.` : 'New prescription sent.');
      }}
    />
  );

  return (
    <Dialog open onClose={respond.isPending ? undefined : onClose} fullWidth maxWidth={showForm ? 'lg' : 'md'}>
      <DialogTitle>
        {request
          ? `Refill request from ${pharmacyName}`
          : data
          ? `Refill request from ${getPatientName(data.patient.name).firstLastName}`
          : 'Refill request'}
        {data && (
          <Typography variant="body2" color="text.secondary">
            {[
              getPatientName(data.patient.name).firstLastName,
              data.patient.gender && capitalize(data.patient.gender),
              data.patient.birthDate && formatDateForDisplay(data.patient.birthDate),
            ]
              .filter(Boolean)
              .join(' · ')}
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
            {request?.withdrawn && (
              <Alert severity="warning">{pharmacyName} withdrew this request. It can’t be answered.</Alert>
            )}
            {request && !request.withdrawn && request.closed && (
              <Alert severity="info">This request is closed. It can’t be answered.</Alert>
            )}
            {data.patientRequest?.note && <Typography>{data.patientRequest.note}</Typography>}
            {(contact.address || contact.phone) && (
              <Box>
                <SectionHeading>Patient</SectionHeading>
                <Rows
                  rows={[
                    ...(contact.address ? [{ label: 'Address', value: contact.address }] : []),
                    ...(contact.phone ? [{ label: 'Phone', value: contact.phone }] : []),
                  ]}
                />
              </Box>
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.25fr 1fr' }, gap: 2 }}>
              {request && (
                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                  <SectionHeading>Pharmacy’s request</SectionHeading>
                  <Rows
                    rows={requestRows(request.medication, prescription).map((row) => ({
                      label: row.label === 'Refills' ? 'Refills asked' : row.label,
                      value: row.request,
                      highlight: row.differs,
                    }))}
                  />
                </Box>
              )}
              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: '#F3F6FA' }}>
                <SectionHeading>Original prescription · {formatDateForDisplay(prescription.sent)}</SectionHeading>
                <Rows
                  rows={[
                    ...requestRows(request?.medication ?? {}, prescription)
                      .filter((row) => row.original !== undefined)
                      .map((row) => ({ label: row.label, value: row.original, highlight: row.differs })),
                    ...(prescription.order?.diagnosisCode
                      ? [
                          {
                            label: 'Diagnosis',
                            value: `${prescription.order.diagnosisDescription ?? ''} (${
                              prescription.order.diagnosisCode
                            })`,
                          },
                        ]
                      : []),
                    {
                      label: 'Prescribed',
                      value: [formatDateForDisplay(prescription.sent), data.prescriberName].filter(Boolean).join(' · '),
                    },
                  ]}
                />
              </Box>
            </Box>
            {sent && <Alert severity="success">{sent}</Alert>}
            {!request && orderForm}
            {request && !sent && (
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
                    setAnswer(next);
                    setReason('');
                    setNote('');
                  }}
                >
                  {(Object.keys(ANSWER_LABEL) as Answer[]).map((key) => (
                    <ToggleButton key={key} value={key} sx={{ textTransform: 'none' }}>
                      {ANSWER_LABEL[key]}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                {orderForm}
                {!closed && answer === 'approve' && (
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
                    inputProps={{ maxLength: answer === 'deny' ? 210 : 70 }}
                    helperText={`Up to ${answer === 'deny' ? 210 : 70} characters`}
                  />
                )}
                {!closed && answer === 'approve' && (
                  <Typography variant="body2" color="text.secondary">
                    Sent as “Approved”. If you change the number of fills, it’s sent as “Approved with changes”.
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
          {sent || closed ? 'Close' : 'Cancel'}
        </RoundedButton>
        {request && !closed && !sent && answer !== 'change' && (
          <RoundedButton variant="contained" disabled={!ready} loading={respond.isPending} onClick={() => void send()}>
            {answer === 'deny' ? 'Send denial' : `Send to ${pharmacyName}`}
          </RoundedButton>
        )}
      </DialogActions>
    </Dialog>
  );
};
