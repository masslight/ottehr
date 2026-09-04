import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { useApiClients } from 'src/hooks/useAppClients';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { createFormTemplateFromUrl, createFormTemplateWithPdf } from './form-templates.api';
import { FORM_TEMPLATES_QUERY_KEY } from './useFormTemplates';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  /** Present when editing. Editing changes metadata only — the PDF itself is not replaceable here. */
};

export const FormTemplateDialog: FC<DialogProps> = ({ open, onClose }) => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<'file' | 'link'>('file');
  const [sourceUrl, setSourceUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!oystehrZambda) throw new Error('API client not available');

      if (source === 'link') {
        return createFormTemplateFromUrl(oystehrZambda, {
          title: title.trim(),
          description: description.trim() || undefined,
          sourceUrl: sourceUrl.trim(),
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
    onSuccess: ({ analysis }) => {
      const mappable = analysis.fields.filter((field) => field.mappable).length;
      enqueueSnackbar(
        analysis.status === 'printable'
          ? 'Uploaded as a draft. This PDF has no fillable fields, so it can be shared but not prefilled.'
          : `Uploaded as a draft with ${mappable} mappable field${mappable === 1 ? '' : 's'}.`,
        { variant: 'success' }
      );
      void queryClient.invalidateQueries({ queryKey: [FORM_TEMPLATES_QUERY_KEY] });
      onClose();
    },
    onError: (err) => {
      setErrorMsg(getApiError({ error: err, defaultError: 'Failed to save the form template.' }));
    },
  });

  const isBusy = saveMutation.isPending;
  const titleError = submitAttempted && !title.trim() ? 'This field is required' : undefined;
  const usingLink = source === 'link';
  const fileError = submitAttempted && !usingLink && !file ? 'A PDF file is required' : undefined;
  const urlError = submitAttempted && usingLink && !sourceUrl.trim() ? 'A link to the PDF is required' : undefined;

  const handleSubmit = (): void => {
    setSubmitAttempted(true);
    if (!title.trim()) return;
    if (usingLink ? !sourceUrl.trim() : !file) return;
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onClose={() => !isBusy && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>New Form Template</DialogTitle>
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

          <ToggleButtonGroup
            value={source}
            exclusive
            size="small"
            disabled={isBusy}
            onChange={(_, next) => next && setSource(next as 'file' | 'link')}
          >
            <ToggleButton value="file">Upload a PDF</ToggleButton>
            <ToggleButton value="link">Import from a link</ToggleButton>
          </ToggleButtonGroup>

          {usingLink ? (
            <TextField
              placeholder="https://example.gov/forms/dwc073.pdf"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              disabled={isBusy}
              error={!!urlError}
              helperText={
                urlError ??
                'The PDF is downloaded and stored here, so the template keeps working if the publisher moves or revises it.'
              }
              label="Link to the PDF"
              fullWidth
            />
          ) : (
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
            </>
          )}
          <Typography variant="body2" color="text.secondary">
            New templates are saved as drafts. Publish a template to make it available in the patient chart.
          </Typography>

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
          Upload
        </RoundedButton>
      </DialogActions>
    </Dialog>
  );
};
