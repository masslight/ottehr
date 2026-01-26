import CloseIcon from '@mui/icons-material/Close';
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
  Skeleton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  BRANDING_CONFIG,
  GetPatientAndResponsiblePartyInfoEndpointOutput,
  InvoiceMessagesPlaceholders,
  parseInvoiceTaskInput,
  PrefilledInvoiceInfo,
  replaceTemplateVariablesArrows,
  REQUIRED_FIELD_ERROR_MESSAGE,
  textingConfig,
} from 'utils';
import { BasicDatePicker } from '../form';
import { RoundedButton } from '../RoundedButton';

export interface SendInvoiceFormData {
  amount: number;
  dueDate: string;
  memo: string;
  smsTextMessage: string;
}

interface SendInvoiceToPatientDialogProps {
  title: string;
  modalOpen: boolean;
  handleClose: () => void;
  onSubmit: (taskId: string, prefilledInvoiceInfo: PrefilledInvoiceInfo) => Promise<void>;
  submitButtonName: string;
  invoiceTask?: Task;
  patientAndRP?: GetPatientAndResponsiblePartyInfoEndpointOutput;
}

export default function SendInvoiceToPatientDialog({
  title,
  modalOpen,
  handleClose,
  onSubmit,
  submitButtonName,
  invoiceTask,
  patientAndRP,
}: SendInvoiceToPatientDialogProps): ReactElement {
  const [disableAllFields, setDisableAllFields] = useState(true);
  const {
    control,
    watch,
    handleSubmit,
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

  const handleSubmitWrapped = (data: SendInvoiceFormData): void => {
    if (invoiceTask && invoiceTask?.id) {
      setDisableAllFields(true);

      void onSubmit(invoiceTask?.id, {
        dueDate: data.dueDate,
        memo: data.memo,
        smsTextMessage: data.smsTextMessage,
        amountCents: Math.round(data.amount * 100),
      });
    } else enqueueSnackbar('Error sending invoice', { variant: 'error' });
  };

  useEffect(() => {
    if (invoiceTask) {
      try {
        const invoiceTaskInput = parseInvoiceTaskInput(invoiceTask);
        if (invoiceTaskInput) {
          const { amountCents } = invoiceTaskInput;
          const dueDate = DateTime.now().plus({ days: textingConfig.invoicing.dueDateInDays }).toISODate();
          const memo = textingConfig.invoicing.stripeMemoMessage;
          const smsMessage = textingConfig.invoicing.smsMessage;
          reset({
            amount: amountCents / 100,
            dueDate: dueDate,
            memo: memo,
            smsTextMessage: smsMessage,
          });
          setDisableAllFields(false);
        }
      } catch {
        /* empty */
      }
    }
  }, [invoiceTask, reset]);

  return (
    <Dialog open={modalOpen}>
      <IconButton onClick={() => handleClose()} size="medium" sx={{ position: 'absolute', right: 12, top: 12 }}>
        <CloseIcon fontSize="medium" sx={{ color: '#938B7D' }} />
      </IconButton>

      <Grid container direction="column" sx={{ padding: 1 }} spacing={0.5}>
        <DialogTitle variant="h4" color="primary.dark">
          {title}
        </DialogTitle>

        <DialogContent>
          {patientAndRP !== undefined ? (
            <Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Patient
                </Typography>
                <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{patientAndRP?.patient.fullName}</Typography>
                <Box sx={{ flexDirection: 'row', display: 'flex' }}>
                  <Typography variant="body2">{patientAndRP?.patient.dob}</Typography>
                  <Typography variant="body2" sx={{ pl: 2 }}>
                    {patientAndRP?.patient.gender}
                  </Typography>
                  <Typography variant="body2" sx={{ pl: 2 }}>
                    {patientAndRP?.patient.phoneNumber}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mt: 2, mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Responsible party name
                </Typography>
                <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{patientAndRP?.responsibleParty.fullName}</Typography>
                <Box sx={{ flexDirection: 'row', display: 'flex' }}>
                  <Typography variant="body2">{patientAndRP?.responsibleParty.email}</Typography>
                  <Typography variant="body2" sx={{ pl: 2 }}>
                    {patientAndRP?.responsibleParty.phoneNumber}
                  </Typography>
                </Box>
              </Box>
            </Box>
          ) : (
            <Skeleton variant="rectangular" animation="wave" />
          )}

          <Grid
            component="form"
            id="send-invoice-form"
            container
            spacing={2}
            onSubmit={handleSubmit(handleSubmitWrapped)}
          >
            <Grid item xs={12} sm={6}>
              <Controller
                name="amount"
                control={control}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                  min: { value: 0.01, message: 'Amount must be greater than 0' },
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
                    disabled={disableAllFields}
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
                disablePast={true}
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
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              width: '100%',
              marginX: 2,
              mb: 1,
            }}
          >
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
