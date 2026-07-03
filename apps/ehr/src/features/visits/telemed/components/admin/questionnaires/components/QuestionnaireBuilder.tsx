import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { Box, Button, Grid, Paper, TextField, Typography } from '@mui/material';
import { Questionnaire } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useMemo, useReducer, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoundedButton } from 'src/components/RoundedButton';
import {
  PracticeManagedQuestionnaire,
  PracticeManagedQuestionnaireItem,
  practiceManagedQuestionnaireToFhir,
  slugify,
} from 'utils';
import { itemsReducer } from '../questionnaire.reducer';
import { QuestionnaireItemEditor } from './QuestionnaireItemEditor';
import { QuestionnairePreview } from './QuestionnairePreview';
import { QuestionnaireTestDialog } from './QuestionnaireTestDialog';

interface QuestionnaireBuilderProps {
  initial?: PracticeManagedQuestionnaire;
  onSave: (questionnaire: PracticeManagedQuestionnaire) => Promise<void>;
  isSaving: boolean;
}

// All slug derivation (linkIds and the canonical url) caps at 60 chars.
const toSlug = (text: string): string => slugify(text, { maxLength: 60 });

// The canonical url/name are identity: existing QuestionnaireResponses reference the
// questionnaire by canonical URL, so editing (even retitling) an existing resource must
// preserve them. Only brand-new questionnaires derive a slug from the title.
const makeCanonicalFields = (
  input: { initial: PracticeManagedQuestionnaire } | { title: string }
): { name: string; url: string } => {
  if ('initial' in input) {
    const { initial } = input;
    return { name: initial.name, url: initial.url };
  } else {
    const { title } = input;
    const slug = toSlug(title);
    return { url: `https://ottehr.com/FHIR/Questionnaire/${slug}`, name: slug };
  }
};

// link ids are derived from the content of the of the item and must be unique amongst all items
function ensureUniqueLinkIds(
  items: PracticeManagedQuestionnaireItem[],
  seen = new Set<string>(),
  pageSlug?: string
): PracticeManagedQuestionnaireItem[] {
  return items.map((item) => {
    let base = item.linkId;
    if (!base && item.text) {
      const textSlug = toSlug(item.text);
      if (item.type === 'group') {
        base = textSlug ? `${textSlug}-page` : '';
      } else if (item.type === 'display') {
        base = pageSlug ? `${pageSlug}-${textSlug}-text` : `${textSlug}-text`;
      } else {
        base = pageSlug ? `${pageSlug}-${textSlug}` : textSlug;
      }
    }
    if (!base) base = `item-${crypto.randomUUID().slice(0, 6)}`;

    let linkId = base;
    let counter = 2;
    while (seen.has(linkId)) {
      linkId = `${base}-${counter}`;
      counter++;
    }
    seen.add(linkId);

    const childPageSlug = item.type === 'group' ? toSlug(item.text || '') : undefined;
    return {
      ...item,
      linkId,
      item: item.item ? ensureUniqueLinkIds(item.item, seen, childPageSlug) : undefined,
    };
  });
}

export const QuestionnaireBuilder: FC<QuestionnaireBuilderProps> = ({ initial, onSave, isSaving }) => {
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [items, dispatch] = useReducer(itemsReducer, initial?.item || []);
  const [titleError, setTitleError] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);

  const navigate = useNavigate();

  const questionnaire = useMemo<PracticeManagedQuestionnaire>(() => {
    const canonicalFields = makeCanonicalFields(initial ? { initial } : { title });
    const status: Questionnaire['status'] = initial ? initial.status : 'active';

    const questionnaire: PracticeManagedQuestionnaire = {
      resourceType: 'Questionnaire',
      status,
      ...(initial?.id && { id: initial.id }),
      ...canonicalFields,
      title,
      ...(description && { description }),
      item: ensureUniqueLinkIds(items),
    };
    return questionnaire;
  }, [initial, title, description, items]);

  const { fhirQuestionnaire, jsonPreview } = useMemo(() => {
    const fhirQuestionnaire = practiceManagedQuestionnaireToFhir(questionnaire);
    const jsonPreview = JSON.stringify(fhirQuestionnaire, null, 2);

    return { fhirQuestionnaire, jsonPreview };
  }, [questionnaire]);

  const handleCopyJson = useCallback(() => {
    void navigator.clipboard.writeText(jsonPreview).then(() => {
      enqueueSnackbar('JSON copied to clipboard', { variant: 'success' });
    });
  }, [jsonPreview]);

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 3, height: 'calc(100vh - 160px)' }}>
        <Box sx={{ flex: '1 1 50%', minWidth: 0, overflow: 'auto' }}>
          <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
            <Typography variant="h4" sx={{ mb: 1.5, color: '#0F347C' }}>
              Questionnaire Properties
            </Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12}>
                <TextField
                  size="small"
                  label="Title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTitleError(false);
                  }}
                  error={titleError}
                  helperText={titleError ? 'Title is required' : undefined}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  size="small"
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                />
              </Grid>
            </Grid>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="h4" sx={{ color: '#0F347C' }}>
                Pages ({items.length})
              </Typography>
              <RoundedButton
                size="medium"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => dispatch({ type: 'ADD_PAGE' })}
              >
                Add Page
              </RoundedButton>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              Each page becomes a separate screen. Add items inside pages using the + button.
            </Typography>

            {items.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                No pages yet. Click "Add Page" to create your first page.
              </Typography>
            )}

            {items.map((item: PracticeManagedQuestionnaireItem) => (
              <QuestionnaireItemEditor key={item._key} item={item} dispatch={dispatch} />
            ))}
          </Paper>

          {/* Spacer for floating buttons */}
          <Box sx={{ height: 64 }} />
        </Box>

        {/* Right column: Form Preview + JSON Preview — independent scroll */}
        <Box
          sx={{
            flex: '1 1 50%',
            overflow: 'auto',
          }}
        >
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="h4" sx={{ color: '#0F347C' }}>
                Form Preview
              </Typography>
              <RoundedButton
                size="medium"
                variant="outlined"
                startIcon={<PlayArrowIcon />}
                onClick={() => setTestDialogOpen(true)}
                disabled={!questionnaire.item?.length}
              >
                Test Form
              </RoundedButton>
            </Box>
            <QuestionnairePreview questionnaire={questionnaire} />
          </Paper>
          <QuestionnaireTestDialog
            open={testDialogOpen}
            onClose={() => setTestDialogOpen(false)}
            questionnaire={fhirQuestionnaire}
          />

          <Paper
            variant="outlined"
            sx={{
              p: 3,
              mt: 2,
              maxHeight: 400,
              overflow: 'auto',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h4" sx={{ color: '#0F347C' }}>
                JSON Preview
              </Typography>
              <Button size="small" startIcon={<ContentCopyIcon />} onClick={handleCopyJson}>
                Copy
              </Button>
            </Box>
            <Box
              component="pre"
              sx={{
                fontSize: 12,
                fontFamily: 'monospace',
                bgcolor: '#f5f5f5',
                p: 1.5,
                borderRadius: 1,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                m: 0,
              }}
            >
              {jsonPreview}
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Floating action bar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          px: 3,
          py: 1.5,
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end',
          zIndex: 1200,
          boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <RoundedButton
          variant="outlined"
          size="medium"
          onClick={() => navigate('/admin/questionnaires')}
          disabled={isSaving}
        >
          Cancel
        </RoundedButton>
        <RoundedButton variant="contained" size="medium" loading={isSaving} onClick={() => onSave(questionnaire)}>
          Save Questionnaire
        </RoundedButton>
      </Box>
    </Box>
  );
};
