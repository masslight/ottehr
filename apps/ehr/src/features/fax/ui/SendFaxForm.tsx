import AddIcon from '@mui/icons-material/Add';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { LoadingButton } from '@mui/lab';
import { Box, Button, DialogActions, DialogContent, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import { GetFaxPacketPreviewOutput } from 'utils/lib/types/api/fax.types';
import { documentLabelGroups, hasNothingToSend } from '../model/faxDocuments';
import { buildDefaultFormValues } from '../model/faxForm';
import { applySaveAsPcp, canAddRecipient, canSend, emptyRecipient } from '../model/faxRecipients';
import { FaxFormValues } from '../model/types';
import { RecipientFields } from './RecipientFields';

interface SendFaxFormProps {
  preview: GetFaxPacketPreviewOutput;
  isSending: boolean;
  onSubmit: (values: FaxFormValues) => void;
  onCancel: () => void;
  /** The number the packet is sent from. Omitted from the dialog when it cannot be resolved. */
  senderFaxNumber?: string;
}

export const SendFaxForm: FC<SendFaxFormProps> = ({ preview, senderFaxNumber, isSending, onSubmit, onCancel }) => {
  const theme = useTheme();

  const methods = useForm<FaxFormValues>({ mode: 'onChange', defaultValues: buildDefaultFormValues(preview) });
  const { control, watch, getValues, handleSubmit } = methods;
  const recipientsArray = useFieldArray({ control, name: 'recipients' });

  const recipients = watch('recipients');
  const { included, excluded } = documentLabelGroups(preview.documents);
  const sendEnabled = canSend(recipients, included.length > 0);

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
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 2 }}>
            <Typography>Fax all visit-related documents</Typography>
            <Tooltip title={documentsTooltip} placement="top">
              <InfoOutlinedIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
            </Tooltip>
          </Stack>

          <Typography variant="subtitle1" sx={{ color: theme.palette.primary.dark, fontWeight: 600, mb: 2 }}>
            Recipient Information
          </Typography>

          {recipientsArray.fields.map((field, index) => (
            <RecipientFields
              key={field.id}
              index={index}
              isPcp={Boolean(recipients[index]?.saveAsPcp)}
              // The record holds exactly one PCP, so selecting one clears the rest.
              onSaveAsPcpChange={(value) =>
                recipientsArray.replace(applySaveAsPcp(getValues('recipients'), index, value))
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
        </DialogContent>

        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <Button
            variant="outlined"
            onClick={onCancel}
            sx={{ borderRadius: '100px', textTransform: 'none', fontWeight: 500 }}
            data-testid={dataTestIds.faxDialog.cancelButton}
          >
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            variant="contained"
            loading={isSending}
            disabled={!sendEnabled || hasNothingToSend(preview.documents)}
            sx={{ borderRadius: '100px', textTransform: 'none', fontWeight: 500 }}
            data-testid={dataTestIds.faxDialog.sendButton}
          >
            Send Fax
          </LoadingButton>
        </DialogActions>
      </form>
    </FormProvider>
  );
};
