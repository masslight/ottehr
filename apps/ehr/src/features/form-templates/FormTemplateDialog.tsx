import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { useApiClients } from 'src/hooks/useAppClients';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { FormTemplateItem } from 'utils/lib/types/api/form-template.types';
import { createFormTemplateWithPdf, updateFormTemplate } from './form-templates.api';
import { FORM_TEMPLATES_QUERY_KEY } from './useFormTemplates';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  /** Present when editing. Editing changes metadata only — the PDF itself is not replaceable here. */
  item?: FormTemplateItem;
};

export const FormTemplateDialog: FC<DialogProps> = ({ open, onClose, item }) => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const isEdit = !!item;

  const [title, setTitle] = useState(item?.title ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!oystehrZambda) throw new Error('API client not available');

      if (isEdit) {
        return updateFormTemplate(oystehrZambda, {
          documentReferenceId: item.documentReferenceId,
          title: title.trim(),
          description: description.trim(),
        });
      }

      if (!file) throw new Error('A PDF file is required');
      return createFormTemplateWithPdf(oystehrZambda, {
        title: title.trim(),
        description: description.trim() || undefined,
        fileName: file.name,
        file,
      });
    },
    onSuccess: (result) => {
      if (isEdit) {
        enqueueSnackbar('Form template updated', { variant: 'success' });
      } else {
        const analysis = 'analysis' in result ? result.analysis : undefined;
        const mappable = analysis?.fields.filter((field) => field.mappable).length ?? 0;
        enqueueSnackbar(
          analysis?.status === 'printable'
            ? 'Uploaded as a draft. This PDF has no fillable fields, so it can be shared but not prefilled.'
            : `Uploaded as a draft with ${mappable} mappable field${mappable === 1 ? '' : 's'}.`,
          { variant: 'success' }
        );
      }
      void queryClient.invalidateQueries({ queryKey: [FORM_TEMPLATES_QUERY_KEY] });
      onClose();
    },
    onError: (err) => {
      setErrorMsg(getApiError({ error: err, defaultError: 'Failed to save the form template.' }));
    },
  });

  const isBusy = saveMutation.isPending;
  const titleError = submitAttempted && !title.trim() ? 'This field is required' : undefined;
  const fileError = submitAttempted && !isEdit && !file ? 'A PDF file is required' : undefined;

  const handleSubmit = (): void => {
    setSubmitAttempted(true);
    if (!title.trim() || (!isEdit && !file)) return;
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onClose={() => !isBusy && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Edit Form Template' : 'New Form Template'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isBusy}
            required
            error={!!titleError}
            helperText={titleError ?? 'Shown to providers in the patient chart.'}
            fullWidth
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isBusy}
            multiline
            minRows={2}
            fullWidth
          />

          {!isEdit && (
            <>
              <RoundedButton component="label" variant="outlined" startIcon={<UploadFileIcon />} disabled={isBusy}>
                {file ? file.name : 'Choose PDF'}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  hidden
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </RoundedButton>
              {fileError && (
                <Typography color="error" variant="body2">
                  {fileError}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                New templates are saved as drafts. Publish a template to make it available in the patient chart.
              </Typography>
            </>
          )}

          {errorMsg && (
            <Typography color="error" variant="body2">
              {errorMsg}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <RoundedButton onClick={onClose} disabled={isBusy}>
          Cancel
        </RoundedButton>
        <RoundedButton
          variant="contained"
          onClick={handleSubmit}
          disabled={isBusy}
          startIcon={isBusy ? <CircularProgress size={16} /> : <UploadFileIcon />}
        >
          {isEdit ? 'Save' : 'Upload'}
        </RoundedButton>
      </DialogActions>
    </Dialog>
  );
};
