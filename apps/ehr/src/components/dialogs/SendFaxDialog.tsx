import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Box,
  Checkbox,
  Divider,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  TextField,
  Typography,
} from '@mui/material';
import { FC, useCallback } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { FAX_MAX_RECIPIENTS, FAX_MAX_TRANSMISSIONS, FaxRecipient } from 'utils';
import { FAX_NUMBER_HELPER_TEXT, FaxNumberField, isFaxNumberValid } from '../FaxNumberField';
import { RoundedButton } from '../RoundedButton';
import { CustomDialog } from './CustomDialog';

/** A visit the user can pick documents from; only rendered when there is a choice to make. */
export interface SendFaxVisitOption {
  appointmentId: string;
  label: string;
}

export interface SendFaxFormData {
  recipients: FaxRecipient[];
  /** Only present when the dialog was given visits to fax. */
  appointmentIds?: string[];
}

/** Mounted only while the dialog should be shown, so each open starts from an empty form. */
interface SendFaxDialogProps {
  title: string;
  /** When given, these visits are faxed; the picker is shown only when there is more than one. */
  visits?: SendFaxVisitOption[];
  onClose: () => void;
  /**
   * Reports the failure to the user and rejects; the dialog then stays open with the entered
   * recipients so the send can be retried or corrected.
   */
  onSend: (data: SendFaxFormData) => Promise<void>;
}

interface SendFaxFormValues {
  recipients: FaxRecipient[];
  selectedAppointmentIds: string[];
}

const EMPTY_RECIPIENT: FaxRecipient = { name: '', organization: '', faxNumber: '', phoneNumber: '' };

const validateOptionalFaxContactNumber = (value: string | undefined): string | true =>
  !value || isFaxNumberValid(value) ? true : 'Enter a 10-digit number';

export const SendFaxDialog: FC<SendFaxDialogProps> = ({ title, visits, onClose, onSend }) => {
  // One fax per selected visit per recipient, so the two selections multiply. Start from the newest
  // visits the limit allows rather than letting the user discover the ceiling on submit.
  const initialAppointmentIds = (visits ?? []).slice(0, FAX_MAX_TRANSMISSIONS).map((visit) => visit.appointmentId);
  const {
    control,
    handleSubmit,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SendFaxFormValues>({
    defaultValues: { recipients: [EMPTY_RECIPIENT], selectedAppointmentIds: initialAppointmentIds },
    mode: 'onBlur',
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'recipients' });
  const selectedAppointmentIds = watch('selectedAppointmentIds');
  const recipientCount = watch('recipients').length;

  // A single visit is faxed without asking; the picker only earns its space when there is a choice.
  const showVisitPicker = (visits?.length ?? 0) > 1;
  const nothingSelected = Boolean(visits?.length) && selectedAppointmentIds.length === 0;
  const transmissionCount = (visits?.length ? selectedAppointmentIds.length : 1) * recipientCount;
  const overTransmissionLimit = transmissionCount > FAX_MAX_TRANSMISSIONS;

  const submit = useCallback(
    async (values: SendFaxFormValues): Promise<void> => {
      try {
        await onSend({
          recipients: values.recipients,
          appointmentIds: visits?.length ? values.selectedAppointmentIds : undefined,
        });
      } catch (error) {
        // onSend surfaces the failure to the user; keep the form as the user left it.
        console.error('Send fax failed', error);
      }
    },
    [onSend, visits?.length]
  );

  return (
    <CustomDialog
      open
      handleClose={onClose}
      title={title}
      dataTestId={dataTestIds.sendFaxDialog.dialog}
      description={
        <Box
          component="form"
          id="send-fax-form"
          onSubmit={handleSubmit(submit)}
          sx={{ width: '100%', maxWidth: '480px' }}
        >
          {showVisitPicker && (
            <>
              <Typography variant="subtitle2" color="primary.dark" sx={{ fontWeight: 600 }}>
                Select Visits
              </Typography>
              <Controller
                name="selectedAppointmentIds"
                control={control}
                render={({ field }) => (
                  <FormGroup sx={{ mb: 2 }}>
                    {visits?.map((visit) => (
                      <FormControlLabel
                        key={visit.appointmentId}
                        label={visit.label}
                        control={
                          <Checkbox
                            checked={field.value.includes(visit.appointmentId)}
                            onChange={(event) =>
                              field.onChange(
                                event.target.checked
                                  ? [...field.value, visit.appointmentId]
                                  : field.value.filter((id) => id !== visit.appointmentId)
                              )
                            }
                          />
                        }
                      />
                    ))}
                    <FormHelperText error sx={{ visibility: nothingSelected ? 'visible' : 'hidden' }}>
                      Select at least one visit
                    </FormHelperText>
                  </FormGroup>
                )}
              />
            </>
          )}

          <Typography variant="subtitle2" color="primary.dark" sx={{ fontWeight: 600, mb: 1 }}>
            Recipient Information
          </Typography>

          {fields.map((field, index) => (
            <Box key={field.id} sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
              {index > 0 && <Divider />}
              <Controller
                name={`recipients.${index}.name`}
                control={control}
                render={({ field: nameField }) => (
                  <TextField {...nameField} fullWidth label="Recipient's name" size="small" />
                )}
              />
              <Controller
                name={`recipients.${index}.organization`}
                control={control}
                render={({ field: organizationField }) => (
                  <TextField {...organizationField} fullWidth label="Organization" size="small" />
                )}
              />
              <Controller
                name={`recipients.${index}.faxNumber`}
                control={control}
                rules={{
                  required: 'Fax number is required',
                  validate: {
                    validNumber: (value) => isFaxNumberValid(value) || FAX_NUMBER_HELPER_TEXT,
                    uniqueNumber: (value) =>
                      getValues('recipients').filter((recipient) => recipient.faxNumber === value).length === 1 ||
                      'This fax number has already been added',
                  },
                }}
                render={({ field: faxField }) => (
                  <FaxNumberField
                    {...faxField}
                    fullWidth
                    required
                    label="Fax number"
                    size="small"
                    error={!!errors.recipients?.[index]?.faxNumber}
                    helperText={errors.recipients?.[index]?.faxNumber?.message}
                    data-testid={dataTestIds.sendFaxDialog.faxNumberInput(index)}
                  />
                )}
              />
              <Controller
                name={`recipients.${index}.phoneNumber`}
                control={control}
                rules={{ validate: validateOptionalFaxContactNumber }}
                render={({ field: phoneField }) => (
                  <FaxNumberField
                    {...phoneField}
                    fullWidth
                    label="Phone number (for follow-up)"
                    size="small"
                    error={!!errors.recipients?.[index]?.phoneNumber}
                    helperText={errors.recipients?.[index]?.phoneNumber?.message}
                  />
                )}
              />
              {index > 0 && (
                <RoundedButton
                  variant="text"
                  color="error"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={() => remove(index)}
                >
                  Remove Recipient
                </RoundedButton>
              )}
            </Box>
          ))}

          <RoundedButton
            variant="text"
            startIcon={<AddIcon />}
            disabled={recipientCount >= FAX_MAX_RECIPIENTS}
            onClick={() => append(EMPTY_RECIPIENT)}
            data-testid={dataTestIds.sendFaxDialog.addRecipientButton}
          >
            Add Recipient
          </RoundedButton>

          {overTransmissionLimit && (
            <FormHelperText error data-testid={dataTestIds.sendFaxDialog.transmissionLimitMessage}>
              {`This would send ${transmissionCount} faxes; at most ${FAX_MAX_TRANSMISSIONS} can be sent at once. Select fewer visits or recipients.`}
            </FormHelperText>
          )}
        </Box>
      }
      actions={
        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <RoundedButton onClick={onClose}>Cancel</RoundedButton>
          <RoundedButton
            variant="contained"
            type="submit"
            form="send-fax-form"
            loading={isSubmitting}
            disabled={nothingSelected || overTransmissionLimit}
            data-testid={dataTestIds.sendFaxDialog.sendButton}
          >
            Send Fax
          </RoundedButton>
        </Box>
      }
    />
  );
};
