import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Task } from 'fhir/r4b';
import { ReactElement, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  BRANDING_CONFIG,
  formatPhoneNumberDisplay,
  InvoiceMessagesPlaceholders,
  parseInvoiceTaskInput,
  PrefilledInvoiceInfo,
  replaceTemplateVariablesArrows,
  REQUIRED_FIELD_ERROR_MESSAGE,
} from 'utils';
import { BasicDatePicker } from '../form';
import { RoundedButton } from '../RoundedButton';

export interface SendInvoiceFormData {
  amount: number;
  dueDate: string;
  memo: string;
  smsTextMessage: string;
}

type PatientAndResponsibleParty = {
  patient: {
    name: string;
    dob: string;
    gender: string;
    phone: string;
  };
  responsibleParty: {
    name: string;
    email?: string;
    phone: string;
  };
};

interface SendInvoiceToPatientDialogProps {
  title: string;
  modalOpen: boolean;
  handleClose: () => void;
  onSubmit: (taskId: string, prefilledInvoiceInfo: PrefilledInvoiceInfo) => Promise<void>;
  submitButtonName: string;
  invoiceTask?: Task;
}

export default function SendInvoiceToPatientDialog({
  title,
  modalOpen,
  handleClose,
  // onSubmit,
  submitButtonName,
  invoiceTask,
}: SendInvoiceToPatientDialogProps): ReactElement {
  const [disableAllFields, setDisableAllFields] = useState(false);
  const [patientAndRP, setPatientAndRP] = useState<PatientAndResponsibleParty | undefined>(undefined);
  const {
    control,
    watch,
    // handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SendInvoiceFormData>({
    mode: 'onBlur',
  });
  const invoiceMessagesPlaceholders: InvoiceMessagesPlaceholders = {
    clinic: BRANDING_CONFIG.projectName,
    amount: watch('amount')?.toString(),
    'due-date': watch('dueDate'),
    'invoice-link': 'https://example.com/invoice-link',
  };
  const smsMessagePrefilledPreview = replaceTemplateVariablesArrows(
    watch('smsTextMessage'),
    invoiceMessagesPlaceholders
  );
  const memoMessagePrefilledPreview = replaceTemplateVariablesArrows(watch('memo'), invoiceMessagesPlaceholders);

  // const handleSubmitWrapped = (data: SendInvoiceFormData): void => {
  //   if (invoiceTask && invoiceTask?.id) {
  //     setDisableAllFields(true);
  //     const invoiceTaskInput = parseInvoiceTaskInput(invoiceTask);
  //     if (invoiceTaskInput) {
  //       // getting disabled fields from initial input
  //       void onSubmit(invoiceTask?.id, {
  //         recipientName: invoiceTaskInput.recipientName,
  //         recipientEmail: invoiceTaskInput.recipientEmail,
  //         recipientPhoneNumber: invoiceTaskInput.recipientPhoneNumber,
  //         dueDate: data.dueDate,
  //         memo: data.memo,
  //         smsTextMessage: data.smsTextMessage,
  //       });
  //     }
  //   } else enqueueSnackbar('Error sending invoice', { variant: 'error' });
  // };

  useEffect(() => {
    if (invoiceTask) {
      console.log(invoiceTask.id);
      setDisableAllFields(false);
      const invoiceTaskInput = parseInvoiceTaskInput(invoiceTask);
      if (invoiceTaskInput) {
        const {
          patientFullName,
          patientDob,
          patientGender,
          patientPhoneNumber,
          responsiblePartyName,
          responsiblePartyEmail,
          responsiblePartyPhoneNumber,
          dueDate,
          memo,
          smsTextMessage,
          amountCents,
        } = invoiceTaskInput;
        setPatientAndRP({
          patient: {
            name: patientFullName,
            dob: patientDob,
            gender: patientGender,
            phone: formatPhoneNumberDisplay(patientPhoneNumber),
          },
          responsibleParty: {
            name: responsiblePartyName,
            email: responsiblePartyEmail,
            phone: formatPhoneNumberDisplay(responsiblePartyPhoneNumber),
          },
        });
        reset({
          amount: amountCents / 100,
          dueDate: dueDate,
          memo: memo,
          smsTextMessage: smsTextMessage,
        });
      }
    }
  }, [invoiceTask, reset]);

  return (
    <Dialog open={modalOpen}>
      <Grid container direction="column" sx={{ padding: 1 }} spacing={0.5}>
        <DialogTitle variant="h4" color="primary.dark">
          {title}
        </DialogTitle>

        <DialogContent>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Patient
            </Typography>
            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{patientAndRP?.patient.name}</Typography>
            <Box sx={{ flexDirection: 'row', display: 'flex' }}>
              <Typography variant="body2">{patientAndRP?.patient.dob}</Typography>
              <Typography variant="body2" sx={{ pl: 2 }}>
                {patientAndRP?.patient.gender}
              </Typography>
              <Typography variant="body2" sx={{ pl: 2 }}>
                {patientAndRP?.patient.phone}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 2, mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Responsible party name
            </Typography>
            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{patientAndRP?.responsibleParty.name}</Typography>
            <Box sx={{ flexDirection: 'row', display: 'flex' }}>
              <Typography variant="body2">{patientAndRP?.responsibleParty.email}</Typography>
              <Typography variant="body2" sx={{ pl: 2 }}>
                {patientAndRP?.responsibleParty.phone}
              </Typography>
            </Box>
          </Box>

          {/*<Box component="form" id="send-invoice-form" onSubmit={handleSubmit(handleSubmitWrapped)} sx={{ mt: 2 }}>*/}
          <Grid component="form" id="send-invoice-form" container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Controller
                name="amount"
                control={control}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="number"
                    label="Amount, $"
                    error={!!errors.amount}
                    helperText={errors.amount?.message}
                    required
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <BasicDatePicker
                name="dueDate"
                label="Due date"
                variant="outlined"
                control={control}
                rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                component="Picker"
                disabled={disableAllFields}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="smsTextMessage"
                control={control}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                }}
                disabled={disableAllFields}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Sms message"
                    multiline
                    rows={4}
                    error={!!errors.smsTextMessage}
                    helperText={errors.smsTextMessage?.message}
                    required
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                          <Tooltip title={smsMessagePrefilledPreview} arrow>
                            <IconButton edge="end" size="small">
                              <InfoOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="memo"
                control={control}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                }}
                disabled={disableAllFields}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Invoice memo"
                    multiline
                    rows={4}
                    error={!!errors.memo}
                    helperText={errors.memo?.message}
                    required
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                          <Tooltip title={memoMessagePrefilledPreview} arrow>
                            <IconButton edge="end" size="small">
                              <InfoOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
            <RoundedButton variant="outlined" onClick={handleClose} size="medium">
              Cancel
            </RoundedButton>
            <RoundedButton
              disabled={disableAllFields}
              loading={isSubmitting}
              form="send-invoice-form"
              type="submit"
              variant="contained"
              color="primary"
            >
              {submitButtonName}
            </RoundedButton>
          </Box>
        </DialogActions>
      </Grid>
    </Dialog>
  );
}
