import AddIcon from '@mui/icons-material/Add';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { LoadingButton } from '@mui/lab';
import { Box, Button, DialogActions, DialogContent, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { GetFaxPacketPreviewOutput } from 'utils';
import { availableDocumentLabels, hasNothingToSend } from '../model/faxDocuments';
import { buildDefaultFormValues } from '../model/faxForm';
import { applySaveAsPcp, canAddRecipient, canSend, emptyRecipient } from '../model/faxRecipients';
import { FaxFormValues } from '../model/types';
import { RecipientFields } from './RecipientFields';

interface SendFaxFormProps {
  preview: GetFaxPacketPreviewOutput;
  isSending: boolean;
  onSubmit: (values: FaxFormValues) => void;
  onCancel: () => void;
}

export const SendFaxForm: FC<SendFaxFormProps> = ({ preview, isSending, onSubmit, onCancel }) => {
  const theme = useTheme();

  const methods = useForm<FaxFormValues>({ mode: 'onChange', defaultValues: buildDefaultFormValues(preview) });
  const { control, watch, getValues, handleSubmit } = methods;
  const recipientsArray = useFieldArray({ control, name: 'recipients' });

  const recipients = watch('recipients');
  const includedLabels = availableDocumentLabels(preview.documents);
  const sendEnabled = canSend(recipients, includedLabels.length > 0);

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 2 }}>
            <Typography>Fax all visit-related documents</Typography>
            <Tooltip
              title={includedLabels.length > 0 ? includedLabels.join(', ') : 'No documents to fax for this visit yet.'}
              placement="top"
            >
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
