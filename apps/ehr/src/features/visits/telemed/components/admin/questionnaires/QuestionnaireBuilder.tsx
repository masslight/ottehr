import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { Box, Button, Grid, Paper, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useMemo, useReducer, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { slugify } from 'utils';
import { itemsReducer } from './questionnaire.reducer';
import { FhirQuestionnaire, QuestionnaireItem, QuestionnaireStatus } from './questionnaire.types';
import { QuestionnaireItemEditor } from './QuestionnaireItemEditor';
import { QuestionnairePreview } from './QuestionnairePreview';
import { QuestionnaireTestDialog } from './QuestionnaireTestDialog';

interface QuestionnaireBuilderProps {
  initial?: FhirQuestionnaire;
  onSave: (questionnaire: FhirQuestionnaire) => Promise<void>;
  onCancel: () => void;
}

const EXTENSION_BASE = 'https://fhir.zapehr.com/r4/StructureDefinitions';

// Internal fields that get stripped or converted to FHIR extensions
const INTERNAL_FIELDS = new Set(['_key', 'dataType', 'inputWidth']);
const OTTEHR_EXTENSION_URLS = new Set([`${EXTENSION_BASE}/data-type`, `${EXTENSION_BASE}/input-width`]);
// Boolean flags where false is the FHIR default and can be omitted. Other false values are
// meaningful data (e.g. enableWhen.answerBoolean: false) and must round-trip.
const OMITTABLE_FALSE_FLAGS = new Set(['required', 'repeats', 'readOnly', 'initialSelected']);

function toFhirJson(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(toFhirJson);
  if (obj && typeof obj === 'object') {
    const record = obj as Record<string, unknown>;

    // Build FHIR extension[] from Ottehr fields, merged with any existing extensions
    const ottehrExtensions: { url: string; valueString: string }[] = [];
    if (record.dataType && typeof record.dataType === 'string') {
      ottehrExtensions.push({ url: `${EXTENSION_BASE}/data-type`, valueString: record.dataType });
    }
    if (record.inputWidth && typeof record.inputWidth === 'string') {
      ottehrExtensions.push({ url: `${EXTENSION_BASE}/input-width`, valueString: record.inputWidth });
    }

    // Preserve non-Ottehr extensions from imported questionnaires
    const existingExtensions = Array.isArray(record.extension)
      ? (record.extension as { url: string }[]).filter((e) => !OTTEHR_EXTENSION_URLS.has(e.url))
      : [];
    const mergedExtensions = [...existingExtensions, ...ottehrExtensions];

    const entries = Object.entries(record)
      .filter(([k]) => !INTERNAL_FIELDS.has(k))
      .filter(([k]) => k !== 'extension') // handled separately via merge
      .filter(([, v]) => v !== undefined && v !== '')
      .filter(([k, v]) => !(v === false && OMITTABLE_FALSE_FLAGS.has(k)))
      .filter(([, v]) => !(Array.isArray(v) && v.length === 0))
      .map(([k, v]) => [k, toFhirJson(v)]);

    if (mergedExtensions.length > 0) {
      entries.push(['extension', mergedExtensions]);
    }

    return Object.fromEntries(entries);
  }
  return obj;
}

// All slug derivation (linkIds and the canonical url) caps at 60 chars.
const toSlug = (text: string): string => slugify(text, { maxLength: 60 });

function ensureUniqueLinkIds(
  items: QuestionnaireItem[],
  seen = new Set<string>(),
  pageSlug?: string
): QuestionnaireItem[] {
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

export const QuestionnaireBuilder: FC<QuestionnaireBuilderProps> = ({ initial, onSave, onCancel }) => {
  const [title, setTitle] = useState(initial?.title || '');
  // No user-facing status concept: a questionnaire is either live (active) or deleted (retired,
  // set via the Delete action). New questionnaires are created active; edits preserve the existing
  // status so editing a live form never changes it.
  const [status] = useState<QuestionnaireStatus>(initial?.status || 'active');
  const [description, setDescription] = useState(initial?.description || '');
  const [items, dispatch] = useReducer(itemsReducer, initial?.item || []);
  const [titleError, setTitleError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);

  const questionnaire = useMemo<FhirQuestionnaire>(() => {
    // The canonical url/name are identity: existing QuestionnaireResponses reference the
    // questionnaire by canonical URL, so editing (even retitling) an existing resource must
    // preserve them. Only brand-new questionnaires derive a slug from the title.
    const canonicalFields = initial?.id
      ? { ...(initial.url && { url: initial.url }), ...(initial.name && { name: initial.name }) }
      : title
      ? (() => {
          const slug = toSlug(title);
          return { url: `https://ottehr.com/FHIR/Questionnaire/${slug}`, name: slug };
        })()
      : {};
    const q: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      ...(initial?.id && { id: initial.id }),
      ...canonicalFields,
      title: title || undefined,
      status,
      ...(description && { description }),
      item: ensureUniqueLinkIds(items),
    };
    return toFhirJson(q) as FhirQuestionnaire;
  }, [initial?.id, initial?.url, initial?.name, title, status, description, items]);

  const jsonPreview = useMemo(() => JSON.stringify(questionnaire, null, 2), [questionnaire]);

  const handleCopyJson = useCallback(() => {
    void navigator.clipboard.writeText(jsonPreview).then(() => {
      enqueueSnackbar('JSON copied to clipboard', { variant: 'success' });
    });
  }, [jsonPreview]);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setTitleError(true);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...questionnaire,
        id: initial?.id,
      });
    } finally {
      setSaving(false);
    }
  }, [title, questionnaire, initial?.id, onSave]);

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 3, height: 'calc(100vh - 160px)' }}>
        {/* Left column: Form — scrollable */}
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

            {items.map((item: QuestionnaireItem) => (
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
            questionnaire={questionnaire}
            rawItems={items}
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
        <RoundedButton variant="outlined" size="medium" onClick={onCancel} disabled={saving}>
          Cancel
        </RoundedButton>
        <RoundedButton variant="contained" size="medium" loading={saving} onClick={handleSave}>
          Save Questionnaire
        </RoundedButton>
      </Box>
    </Box>
  );
};
