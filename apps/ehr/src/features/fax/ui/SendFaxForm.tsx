import AddIcon from '@mui/icons-material/Add';
import { LoadingButton } from '@mui/lab';
import { Box, Button, DialogActions, DialogContent, Divider, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { FaxDocumentKind, GetFaxPacketPreviewOutput } from 'utils';
import { buildDocumentRows, toggleKind } from '../model/faxDocuments';
import { buildDefaultFormValues } from '../model/faxForm';
import { applySaveAsPcp, canAddRecipient, canSend, emptyRecipient } from '../model/faxRecipients';
import { FaxDocumentSelectionMode, FaxFormValues } from '../model/types';
import { DocumentSelector } from './DocumentSelector';
import { RecipientFields } from './RecipientFields';

interface SendFaxFormProps {
  preview: GetFaxPacketPreviewOutput;
  isSending: boolean;
  onSubmit: (values: FaxFormValues) => void;
  onCancel: () => void;
}

/**
 * The Send Fax form. Mounts only after the preview has loaded, so `useForm` seeds itself from the preview at
 * mount — no syncing effect. Document selection and the recipient list are react-hook-form state.
 */
export const SendFaxForm: FC<SendFaxFormProps> = ({ preview, isSending, onSubmit, onCancel }) => {
  const theme = useTheme();

  const methods = useForm<FaxFormValues>({
    mode: 'onChange',
    defaultValues: buildDefaultFormValues(preview),
  });
  const { control, watch, setValue, getValues, handleSubmit } = methods;
  const recipientsArray = useFieldArray({ control, name: 'recipients' });

  const mode = watch('mode');
  const selectedKinds = watch('selectedKinds');
  const recipients = watch('recipients');

  const documentRows = buildDocumentRows(preview.documents, selectedKinds, mode);
  const sendEnabled = canSend({ mode, availability: preview.documents, selectedKinds, recipients });

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <DocumentSelector
            title="What documents do you want to send?"
            rows={documentRows}
            mode={mode}
            onModeChange={(next: FaxDocumentSelectionMode) => setValue('mode', next)}
            onToggle={(id) => setValue('selectedKinds', toggleKind(selectedKinds, id as FaxDocumentKind))}
          />

          <Divider sx={{ my: 2 }} />

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
            disabled={!sendEnabled}
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
