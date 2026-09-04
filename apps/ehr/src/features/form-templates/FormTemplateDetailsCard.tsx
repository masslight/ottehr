import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Card,
  CardContent,
  CircularProgress,
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
import { FormTemplateItem } from 'utils/lib/types/api/form-template.types';
import { replaceFormTemplateFromUrl, replaceFormTemplateWithPdf, updateFormTemplate } from './form-templates.api';
import { clearMappingDraft } from './mapping-draft';
import { FORM_TEMPLATES_QUERY_KEY } from './useFormTemplates';

/**
 * Name, description and the PDF itself — everything about a template except how its fields are mapped.
 *
 * Separate from the mapping below it because the two are edited on different rhythms: a name is corrected
 * in passing, while a mapping is a sitting. Sharing one save button would make each change wait on the
 * other being finished.
 */
export const FormTemplateDetailsCard: FC<{ item: FormTemplateItem }> = ({ item }) => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? '');
  const [source, setSource] = useState<'file' | 'link'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');

  const usingLink = source === 'link';
  const replacement = usingLink ? sourceUrl.trim() : file;
  const metadataChanged = title.trim() !== item.title || description.trim() !== (item.description ?? '');

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!oystehrZambda) throw new Error('API client not available');

      if (metadataChanged) {
        await updateFormTemplate(oystehrZambda, {
          documentReferenceId: item.documentReferenceId,
          title: title.trim(),
          description: description.trim(),
        });
      }

      // Second, so a rejected replacement cannot also lose the metadata change just made.
      if (!replacement) return undefined;

      const replaced = usingLink
        ? await replaceFormTemplateFromUrl(oystehrZambda, {
            documentReferenceId: item.documentReferenceId,
            title: title.trim(),
            sourceUrl: sourceUrl.trim(),
          })
        : await replaceFormTemplateWithPdf(oystehrZambda, {
            documentReferenceId: item.documentReferenceId,
            title: title.trim(),
            file: file!,
          });

      // A draft authored against the previous field inventory would otherwise be restored on the next
      // visit and quietly reinstate bindings the replacement just reconciled away.
      clearMappingDraft(item.documentReferenceId);
      return replaced;
    },
    onSuccess: (replaced) => {
      if (!replaced) {
        enqueueSnackbar('Form template updated', { variant: 'success' });
      } else if (replaced.droppedBindings.length > 0) {
        const count = replaced.droppedBindings.length;
        enqueueSnackbar(
          `PDF replaced. ${count} mapped field${count === 1 ? '' : 's'} no longer exist in the new PDF and ` +
            `${count === 1 ? 'its mapping was' : 'their mappings were'} removed` +
            `${replaced.returnedToDraft ? '. The template has been returned to draft for review.' : '.'}`,
          { variant: 'warning', autoHideDuration: 12000 }
        );
      } else {
        enqueueSnackbar('PDF replaced. All existing field mappings still apply.', { variant: 'success' });
      }

      setFile(null);
      setSourceUrl('');
      void queryClient.invalidateQueries({ queryKey: [FORM_TEMPLATES_QUERY_KEY] });
    },
    onError: (err) => {
      enqueueSnackbar(getApiError({ error: err, defaultError: 'Failed to save the form template.' }), {
        variant: 'error',
      });
    },
  });

  const isBusy = saveMutation.isPending;
  const canSave = !isBusy && !!title.trim() && (metadataChanged || !!replacement);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="subtitle1" fontWeight={600}>
            Details
          </Typography>

          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isBusy}
            error={!title.trim()}
            helperText={!title.trim() ? 'This field is required' : undefined}
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

          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Replace the PDF only if the form itself has changed. Its fields are read again, and any mapping pointing
              at a field the new PDF does not contain is removed.
            </Typography>

            <ToggleButtonGroup
              value={source}
              exclusive
              size="small"
              disabled={isBusy}
              onChange={(_, next) => next && setSource(next as 'file' | 'link')}
            >
              <ToggleButton value="file">Upload a PDF</ToggleButton>
              <ToggleButton value="link">Replace from a link</ToggleButton>
            </ToggleButtonGroup>

            {usingLink ? (
              <TextField
                label="Link to the replacement PDF"
                placeholder="https://example.gov/forms/dwc073.pdf"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                disabled={isBusy}
                fullWidth
              />
            ) : (
              <RoundedButton
                component="label"
                variant="outlined"
                startIcon={<UploadFileIcon />}
                disabled={isBusy}
                sx={{ alignSelf: 'flex-start' }}
              >
                {file ? file.name : 'Choose PDF'}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  hidden
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </RoundedButton>
            )}
          </Stack>

          <Stack direction="row" justifyContent="flex-end">
            <RoundedButton
              variant="contained"
              disabled={!canSave}
              startIcon={isBusy ? <CircularProgress size={16} /> : undefined}
              onClick={() => saveMutation.mutate()}
            >
              Save details
            </RoundedButton>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};
