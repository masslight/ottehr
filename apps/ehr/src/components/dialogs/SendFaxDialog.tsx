import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Patient, Practitioner } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { phone } from 'phone';
import { FC, useMemo, useState } from 'react';
import { getFaxDocuments, sendFax } from 'src/api/api';
import InputMask from 'src/components/InputMask';
import { dataTestIds } from 'src/constants/data-test-ids';
import { formatISOStringToDateAndTime } from 'src/helpers/formatDateTime';
import { useApiClients } from 'src/hooks/useAppClients';
import { useGetPatientVisitHistory } from 'src/hooks/useGetPatientVisitHistory';
import {
  APIError,
  FAX_DOCUMENT_TYPE_LABELS,
  FAX_DOCUMENT_TYPES,
  FaxDocumentType,
  GetFaxDocumentsOutput,
  getFirstName,
  getLastName,
  isApiError,
  isPhoneNumberValid,
  PRACTICE_NAME_URL,
} from 'utils';
import { CustomDialog } from './CustomDialog';

interface RecipientFormState {
  name: string;
  organization: string;
  /** digits only */
  faxNumber: string;
  /** digits only */
  phoneNumber: string;
}

const emptyRecipient = (): RecipientFormState => ({ name: '', organization: '', faxNumber: '', phoneNumber: '' });

const toDigits = (value: string | undefined): string => (value ?? '').replace(/\D/g, '').slice(-10);

const isFaxNumberValid = (digits: string): boolean => isPhoneNumberValid(digits) && phone(digits).isValid;

/**
 * Builds the initial recipient list from the patient's PCP, following the
 * auto-population priority: name + fax when both are on file, name only when
 * the fax is missing, and a blank recipient when there is no PCP at all.
 */
const recipientFromPcp = (patient: Patient | undefined): RecipientFormState => {
  const pcp = patient?.contained?.find(
    (resource): resource is Practitioner => resource.resourceType === 'Practitioner' && resource.active !== false
  );
  if (!pcp) return emptyRecipient();
  const name = [getFirstName(pcp), getLastName(pcp)].filter(Boolean).join(' ');
  const organization = pcp.extension?.find((ext) => ext.url === PRACTICE_NAME_URL)?.valueString ?? '';
  const faxNumber = toDigits(pcp.telecom?.find((c) => c.system === 'fax' && c.period?.end === undefined)?.value);
  const phoneNumber = toDigits(pcp.telecom?.find((c) => c.system === 'phone' && c.period?.end === undefined)?.value);
  return { name, organization, faxNumber, phoneNumber };
};

interface SendFaxDialogProps {
  open: boolean;
  onClose: () => void;
  patient?: Patient;
  /** When provided the fax is scoped to this visit; otherwise a visit selector is shown. */
  appointmentId?: string;
}

export const SendFaxDialog: FC<SendFaxDialogProps> = ({ open, onClose, patient, appointmentId }) => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  const showVisitSelector = appointmentId === undefined;
  const { data: visitHistory, isLoading: visitsLoading } = useGetPatientVisitHistory(
    showVisitSelector ? patient?.id : undefined
  );
  const visitOptions = useMemo(() => {
    const visits = (visitHistory?.visits ?? []).filter(
      (visit) => visit.appointmentId && visit.dateTime && visit.status !== 'cancelled' && visit.status !== 'no show'
    );
    return [...visits].sort((a, b) => (b.dateTime ?? '').localeCompare(a.dateTime ?? ''));
  }, [visitHistory]);

  const [selectedVisitId, setSelectedVisitId] = useState<string | undefined>(undefined);
  const effectiveAppointmentId = appointmentId ?? selectedVisitId ?? visitOptions[0]?.appointmentId;

  const [checkedDocuments, setCheckedDocuments] = useState<Record<FaxDocumentType, boolean>>(
    Object.fromEntries(FAX_DOCUMENT_TYPES.map((type) => [type, true])) as Record<FaxDocumentType, boolean>
  );
  const [recipients, setRecipients] = useState<RecipientFormState[]>([recipientFromPcp(patient)]);
  const [isSending, setIsSending] = useState(false);

  const { data: faxDocuments, isLoading: availabilityLoading } = useQuery({
    queryKey: ['get-fax-documents', effectiveAppointmentId],
    queryFn: async (): Promise<GetFaxDocumentsOutput> => {
      if (oystehrZambda && effectiveAppointmentId) {
        return getFaxDocuments(oystehrZambda, { appointmentId: effectiveAppointmentId });
      }
      throw new Error('api client not defined or appointmentId not provided');
    },
    enabled: Boolean(oystehrZambda) && Boolean(effectiveAppointmentId),
  });
  const availableDocuments = useMemo(() => new Set(faxDocuments?.availableDocuments ?? []), [faxDocuments]);

  const selectedDocuments = FAX_DOCUMENT_TYPES.filter((type) => checkedDocuments[type] && availableDocuments.has(type));

  const updateRecipient = (index: number, update: Partial<RecipientFormState>): void => {
    setRecipients((prev) => prev.map((recipient, i) => (i === index ? { ...recipient, ...update } : recipient)));
  };

  const allFaxNumbersValid = recipients.every((recipient) => isFaxNumberValid(recipient.faxNumber));
  const canSend =
    Boolean(effectiveAppointmentId) && selectedDocuments.length > 0 && allFaxNumbersValid && !availabilityLoading;

  const handleSendFax = async (): Promise<void> => {
    if (!oystehrZambda || !effectiveAppointmentId) {
      enqueueSnackbar('API client not available. Please try again.', { variant: 'error' });
      return;
    }

    setIsSending(true);
    try {
      const response = await sendFax(oystehrZambda, {
        appointmentId: effectiveAppointmentId,
        documents: selectedDocuments,
        recipients: recipients.map((recipient) => ({
          name: recipient.name.trim() || undefined,
          organization: recipient.organization.trim() || undefined,
          faxNumber: recipient.faxNumber,
          phoneNumber: recipient.phoneNumber || undefined,
        })),
      });
      if (response.failedFaxNumbers?.length) {
        enqueueSnackbar(response.message, { variant: 'warning' });
      } else {
        enqueueSnackbar(recipients.length > 1 ? `Faxes sent to ${recipients.length} recipients.` : 'Fax sent.', {
          variant: 'success',
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['get-visit-fax-history', effectiveAppointmentId] });
      onClose();
    } catch (error) {
      console.error('Error sending fax:', error);
      enqueueSnackbar(isApiError(error) ? (error as APIError).message : 'Error sending fax.', { variant: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <CustomDialog
      open={open}
      handleClose={onClose}
      title="Send Fax"
      dataTestId={dataTestIds.sendFaxDialog.dialog}
      description={
        <Stack spacing={2} sx={{ minWidth: { sm: 480 }, pt: 1 }}>
          {showVisitSelector && (
            <TextField
              select
              fullWidth
              label="Visit"
              size="small"
              value={effectiveAppointmentId ?? ''}
              onChange={(e) => setSelectedVisitId(e.target.value)}
              disabled={visitsLoading || visitOptions.length === 0}
              helperText={!visitsLoading && visitOptions.length === 0 ? 'No visits found for this patient' : undefined}
              data-testid={dataTestIds.sendFaxDialog.visitSelect}
            >
              {visitOptions.map((visit) => (
                <MenuItem key={visit.appointmentId} value={visit.appointmentId}>
                  {formatISOStringToDateAndTime(visit.dateTime!)}
                  {visit.office ? ` - ${visit.office}` : ''}
                </MenuItem>
              ))}
            </TextField>
          )}

          <Box>
            <Typography color="primary.dark" sx={{ fontWeight: 600 }}>
              What documents do you want to send?
            </Typography>
            <FormGroup>
              {FAX_DOCUMENT_TYPES.map((type) => {
                const isAvailable = availableDocuments.has(type);
                const disabled = availabilityLoading || !isAvailable;
                return (
                  <FormControlLabel
                    key={type}
                    control={
                      <Checkbox
                        checked={checkedDocuments[type] && isAvailable}
                        disabled={disabled}
                        onChange={(e) => setCheckedDocuments((prev) => ({ ...prev, [type]: e.target.checked }))}
                        data-testid={dataTestIds.sendFaxDialog.documentCheckbox(type)}
                      />
                    }
                    label={
                      <Typography color={disabled ? 'text.disabled' : 'text.primary'}>
                        {FAX_DOCUMENT_TYPE_LABELS[type]}
                      </Typography>
                    }
                  />
                );
              })}
            </FormGroup>
          </Box>

          <Box>
            <Typography color="primary.dark" sx={{ fontWeight: 600, mb: 2 }}>
              Recipient Information
            </Typography>
            <Stack spacing={3}>
              {recipients.map((recipient, index) => (
                <Stack key={index} spacing={2} sx={{ position: 'relative' }}>
                  {recipients.length > 1 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Recipient {index + 1}
                      </Typography>
                      <IconButton
                        size="small"
                        aria-label="Remove recipient"
                        onClick={() => setRecipients((prev) => prev.filter((_, i) => i !== index))}
                        data-testid={dataTestIds.sendFaxDialog.removeRecipientButton(index)}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                  <TextField
                    fullWidth
                    label="Recipient’s name"
                    value={recipient.name}
                    onChange={(e) => updateRecipient(index, { name: e.target.value })}
                    inputProps={{ 'data-testid': dataTestIds.sendFaxDialog.recipientNameInput(index) }}
                  />
                  <TextField
                    fullWidth
                    label="Organization"
                    value={recipient.organization}
                    onChange={(e) => updateRecipient(index, { organization: e.target.value })}
                    inputProps={{ 'data-testid': dataTestIds.sendFaxDialog.organizationInput(index) }}
                  />
                  <TextField
                    fullWidth
                    required
                    label="Fax number"
                    type="tel"
                    placeholder="(XXX) XXX-XXXX"
                    value={recipient.faxNumber}
                    error={recipient.faxNumber !== '' && !isFaxNumberValid(recipient.faxNumber)}
                    helperText={
                      recipient.faxNumber !== '' && !isFaxNumberValid(recipient.faxNumber)
                        ? 'Fax number must be 10 digits in the format (xxx) xxx-xxxx and a valid number'
                        : undefined
                    }
                    InputProps={{ inputComponent: InputMask as any }}
                    inputProps={{
                      mask: '(000) 000-0000',
                      inputMode: 'numeric',
                      'data-testid': dataTestIds.sendFaxDialog.faxNumberInput(index),
                    }}
                    onChange={(e) => updateRecipient(index, { faxNumber: e.target.value.replace(/\D/g, '') })}
                  />
                  <TextField
                    fullWidth
                    label="Phone number (for follow-up)"
                    type="tel"
                    placeholder="(XXX) XXX-XXXX"
                    value={recipient.phoneNumber}
                    InputProps={{ inputComponent: InputMask as any }}
                    inputProps={{
                      mask: '(000) 000-0000',
                      inputMode: 'numeric',
                      'data-testid': dataTestIds.sendFaxDialog.phoneNumberInput(index),
                    }}
                    onChange={(e) => updateRecipient(index, { phoneNumber: e.target.value.replace(/\D/g, '') })}
                  />
                </Stack>
              ))}
            </Stack>
            <Button
              startIcon={<AddIcon />}
              onClick={() => setRecipients((prev) => [...prev, emptyRecipient()])}
              sx={{ mt: 2, textTransform: 'none', fontWeight: 600 }}
              data-testid={dataTestIds.sendFaxDialog.addRecipientButton}
            >
              Add Recipient
            </Button>
          </Box>
        </Stack>
      }
      actions={
        <>
          <Button
            onClick={onClose}
            disabled={isSending}
            variant="outlined"
            sx={{ borderRadius: 100, textTransform: 'none' }}
            data-testid={dataTestIds.sendFaxDialog.cancelButton}
          >
            Cancel
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <LoadingButton
            onClick={handleSendFax}
            loading={isSending}
            disabled={!canSend}
            variant="contained"
            sx={{ borderRadius: 100, textTransform: 'none' }}
            data-testid={dataTestIds.sendFaxDialog.sendButton}
          >
            Send Fax
          </LoadingButton>
        </>
      }
    />
  );
};
