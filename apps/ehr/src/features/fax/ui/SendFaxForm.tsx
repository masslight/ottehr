import AddIcon from '@mui/icons-material/Add';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { FC, useEffect } from 'react';
import { Controller, FormProvider, useFieldArray, useForm } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import { FAX_MAX_VISITS, GetFaxPacketPreviewOutput } from 'utils/lib/types/api/fax.types';
import { documentLabelGroups, hasNothingToSend } from '../model/faxDocuments';
import { buildDefaultFormValues } from '../model/faxForm';
import { applySaveAsPcp, canAddRecipient, canSend, emptyRecipient } from '../model/faxRecipients';
import { FaxFormValues, FaxVisitOption } from '../model/types';
import { RecipientFields } from './RecipientFields';

interface SendFaxFormProps {
  /** Only a single-visit packet has a document checklist; other sources send a fixed set. */
  preview?: GetFaxPacketPreviewOutput;
  /** The number the packet is sent from. Omitted from the dialog when it cannot be resolved. */
  senderFaxNumber?: string;
  /** When given, the user picks which visits to fax; shown only when there is more than one. */
  visits?: FaxVisitOption[];
  isSending: boolean;
  onSubmit: (values: FaxFormValues) => void;
  /** The `id` of the `<form>`: the dialog's Send Fax button, which lives in the dialog footer, submits it. */
  formId: string;
  /** Tells the dialog whether the form can be sent as it stands, for that button's disabled state. */
  onCanSendChange: (canSend: boolean) => void;
}

export const SendFaxForm: FC<SendFaxFormProps> = ({
  preview,
  senderFaxNumber,
  visits,
  isSending,
  onSubmit,
  formId,
  onCanSendChange,
}) => {
  const theme = useTheme();

  const methods = useForm<FaxFormValues>({
    mode: 'onChange',
    defaultValues: buildDefaultFormValues(preview, visits),
  });
  const { control, watch, getValues, handleSubmit } = methods;
  const recipientsArray = useFieldArray({ control, name: 'recipients' });

  const recipients = watch('recipients');
  const selectedAppointmentIds = watch('selectedAppointmentIds') ?? [];
  // A single visit is faxed without asking; the picker only earns its space when there is a choice.
  const showVisitPicker = (visits?.length ?? 0) > 1;
  const visitSelectionValid = !visits?.length || selectedAppointmentIds.length > 0;
  const tooManyVisits = selectedAppointmentIds.length > FAX_MAX_VISITS;
  const { included, excluded } = documentLabelGroups(preview?.documents ?? []);
  const sendEnabled =
    canSend(recipients, preview ? included.length > 0 : true) && visitSelectionValid && !tooManyVisits;

  const canSendNow = sendEnabled && !(preview ? hasNothingToSend(preview.documents) : false);
  useEffect(() => onCanSendChange(canSendNow), [canSendNow, onCanSendChange]);

  const documentsTooltip = (
    <Box>
      {included.length > 0 ? (
        <>
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
            Included
          </Typography>
          {included.map((label) => (
            <Typography key={label} variant="caption" sx={{ display: 'block' }}>
              • {label}
            </Typography>
          ))}
        </>
      ) : (
        <Typography variant="caption" sx={{ display: 'block' }}>
          No documents to fax for this visit yet.
        </Typography>
      )}
      {excluded.length > 0 && (
        <>
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mt: included.length > 0 ? 1 : 0 }}>
            Not documented yet
          </Typography>
          {excluded.map((label) => (
            <Typography key={label} variant="caption" sx={{ display: 'block', opacity: 0.7 }}>
              • {label}
            </Typography>
          ))}
        </>
      )}
    </Box>
  );

  return (
    <FormProvider {...methods}>
      <form id={formId} onSubmit={handleSubmit(onSubmit)}>
        {preview && (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 2 }}>
            <Typography>Fax all visit-related documents</Typography>
            <Tooltip title={documentsTooltip} placement="top">
              <InfoOutlinedIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
            </Tooltip>
          </Stack>
        )}

        {showVisitPicker && (
          <>
            <Typography variant="subtitle1" sx={{ color: theme.palette.primary.dark, fontWeight: 600, mb: 1 }}>
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
                          checked={(field.value ?? []).includes(visit.appointmentId)}
                          data-testid={`${dataTestIds.faxDialog.visitCheckbox}-${visit.appointmentId}`}
                          onChange={(event) =>
                            field.onChange(
                              event.target.checked
                                ? [...(field.value ?? []), visit.appointmentId]
                                : (field.value ?? []).filter((id: string) => id !== visit.appointmentId)
                            )
                          }
                        />
                      }
                    />
                  ))}
                  {!visitSelectionValid && <FormHelperText error>Select at least one visit</FormHelperText>}
                  {tooManyVisits && (
                    <FormHelperText error>{`A fax can carry at most ${FAX_MAX_VISITS} visits`}</FormHelperText>
                  )}
                </FormGroup>
              )}
            />
          </>
        )}

        <Typography variant="subtitle1" sx={{ color: theme.palette.primary.dark, fontWeight: 600, mb: 2 }}>
          Recipient Information
        </Typography>

        {recipientsArray.fields.map((field, index) => (
          <RecipientFields
            key={field.id}
            index={index}
            isPcp={Boolean(recipients[index]?.saveAsPcp)}
            // Only a single-visit preview offers PCP management. The record holds exactly one PCP,
            // so selecting one recipient clears the flag from the others.
            onSaveAsPcpChange={
              preview
                ? (value) => recipientsArray.replace(applySaveAsPcp(getValues('recipients'), index, value))
                : undefined
            }
            onRemove={index > 0 ? () => recipientsArray.remove(index) : undefined}
          />
        ))}

        <Box>
          <Button
            variant="text"
            startIcon={<AddIcon fontSize="small" />}
            onClick={() => recipientsArray.append(emptyRecipient())}
            disabled={!canAddRecipient(recipients)}
            sx={{ textTransform: 'none', fontWeight: 500 }}
            data-testid={dataTestIds.faxDialog.addRecipient}
          >
            Add Recipient
          </Button>
        </Box>

        {/* Not editable: every fax leaves from the practice's one configured number. It sits at the end
            as a footnote so it doesn't compete with the fields the user actually fills in. */}
        {senderFaxNumber && (
          <Typography
            variant="body2"
            sx={{ color: theme.palette.text.secondary, mt: 1 }}
            data-testid={dataTestIds.faxDialog.senderFax}
          >
            Sender fax number: {formatPhoneNumberDisplay(senderFaxNumber)}
          </Typography>
        )}

        {/* The visible Send Fax button is in the dialog footer, outside this form. This one keeps Enter in a
            field sending the fax under the same conditions as before. */}
        <button type="submit" hidden disabled={!canSendNow || isSending} />
      </form>
    </FormProvider>
  );
};
