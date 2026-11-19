import AddIcon from '@mui/icons-material/Add';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { FC } from 'react';
import { Controller, FormProvider, useFieldArray, useForm } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import { DOCUMENT_PACKET_MAX_VISITS, GetDocumentPacketPreviewOutput } from 'utils/lib/types/api/document-packet.types';
import { documentLabelGroups, hasNothingToSend } from '../model/documents';
import { buildDefaultFormValues } from '../model/form';
import { applySaveAsPcp, canAddRecipient, canSend, emptyRecipient } from '../model/recipients';
import { PacketVisitOption, SendDocumentsFormValues } from '../model/types';
import { RecipientFields } from './RecipientFields';

interface SendDocumentsFormProps {
  /** Only a single-visit packet has a document checklist; other sources send a fixed set. */
  preview?: GetDocumentPacketPreviewOutput;
  /** The number the packet is sent from. Omitted from the dialog when it cannot be resolved. */
  senderFaxNumber?: string;
  /** When given, the user picks which visits to fax; shown only when there is more than one. */
  visits?: PacketVisitOption[];
  isSending: boolean;
  onSubmit: (values: SendDocumentsFormValues) => void;
  onCancel: () => void;
}

export const SendDocumentsForm: FC<SendDocumentsFormProps> = ({
  preview,
  senderFaxNumber,
  visits,
  isSending,
  onSubmit,
  onCancel,
}) => {
  const theme = useTheme();

  const methods = useForm<SendDocumentsFormValues>({
    mode: 'onChange',
    defaultValues: buildDefaultFormValues(preview, visits),
  });
  const { control, watch, getValues, handleSubmit } = methods;
  const recipientsArray = useFieldArray({ control, name: 'recipients' });

  const recipients = watch('recipients');
  const selectedAppointmentIds = watch('selectedAppointmentIds') ?? [];
  // A single visit is sent without asking; the picker only earns its space when there is a choice.
  const showVisitPicker = (visits?.length ?? 0) > 1;
  const visitSelectionValid = !visits?.length || selectedAppointmentIds.length > 0;
  const tooManyVisits = selectedAppointmentIds.length > DOCUMENT_PACKET_MAX_VISITS;
  const { included, excluded } = documentLabelGroups(preview?.documents ?? []);
  const sendEnabled =
    canSend(recipients, preview ? included.length > 0 : true) && visitSelectionValid && !tooManyVisits;

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
          No documents to send for this visit yet.
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
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          {preview && (
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 2 }}>
              <Typography>Send all visit-related documents</Typography>
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
                            data-testid={`${dataTestIds.sendDocumentsDialog.visitCheckbox}-${visit.appointmentId}`}
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
                      <FormHelperText
                        error
                      >{`A fax can carry at most ${DOCUMENT_PACKET_MAX_VISITS} visits`}</FormHelperText>
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
              data-testid={dataTestIds.sendDocumentsDialog.addRecipient}
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
              data-testid={dataTestIds.sendDocumentsDialog.senderFax}
            >
              Sender fax number: {formatPhoneNumberDisplay(senderFaxNumber)}
            </Typography>
          )}
        </DialogContent>

        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <Button
            variant="outlined"
            onClick={onCancel}
            sx={{ borderRadius: '100px', textTransform: 'none', fontWeight: 500 }}
            data-testid={dataTestIds.sendDocumentsDialog.cancelButton}
          >
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            variant="contained"
            loading={isSending}
            disabled={!sendEnabled || (preview ? hasNothingToSend(preview.documents) : false)}
            sx={{ borderRadius: '100px', textTransform: 'none', fontWeight: 500 }}
            data-testid={dataTestIds.sendDocumentsDialog.sendButton}
          >
            Send
          </LoadingButton>
        </DialogActions>
      </form>
    </FormProvider>
  );
};
