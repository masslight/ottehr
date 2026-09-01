import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { FC, useEffect, useMemo, useState } from 'react';
import { buildStubAnswersByPage, collectContextFields, ContextField } from '../test-draft-utils';
import { QuestionnairePreview } from './QuestionnairePreview';

interface TestDraftDialogProps {
  open: boolean;
  onClose: () => void;
  questionnaire: Questionnaire;
}

const STATUS_OPTIONS: QuestionnaireResponse['status'][] = ['in-progress', 'completed', 'amended'];

/** Options for one context field: boolean → True/False; else its condition-referenced answer values, then answerOption. */
const optionsForField = (cf: ContextField): { value: string; label: string }[] => {
  if (cf.field.type === 'boolean') {
    return [
      { value: 'true', label: 'True' },
      { value: 'false', label: 'False' },
    ];
  }
  const source =
    cf.suggestions.length > 0
      ? cf.suggestions
      : (cf.field.answerOption ?? []).map((o) => o.valueString).filter((v): v is string => !!v);
  return source.map((v) => ({ value: v, label: v }));
};

const inputTypeForField = (type: ContextField['field']['type']): string =>
  type === 'date' ? 'date' : type === 'integer' || type === 'decimal' ? 'number' : 'text';

export const TestDraftDialog: FC<TestDraftDialogProps> = ({ open, onClose, questionnaire }) => {
  const { contextFields, statusReferenced } = useMemo(() => collectContextFields(questionnaire), [questionnaire]);

  const [contextValues, setContextValues] = useState<Record<string, string | undefined>>({});
  const [status, setStatus] = useState<QuestionnaireResponse['status']>('in-progress');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [completed, setCompleted] = useState(false);

  const stubAnswersByPage = useMemo(
    () => buildStubAnswersByPage(contextFields, contextValues),
    [contextFields, contextValues]
  );

  // Changing the context can hide the current/last page; drop out of the "complete" screen so the
  // tester can re-walk the form under the new context. (The preview clamps the page index itself.)
  useEffect(() => {
    setCompleted(false);
  }, [contextValues, status]);

  const handleClose = (): void => {
    setContextValues({});
    setStatus('in-progress');
    setCurrentPageIndex(0);
    setCompleted(false);
    onClose();
  };

  const setValue = (linkId: string, value: string | undefined): void =>
    setContextValues((prev) => ({ ...prev, [linkId]: value || undefined }));

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth PaperProps={{ sx: { minHeight: '80vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h5" sx={{ color: '#0F347C' }}>
          Test Draft{questionnaire.version ? ` — v${questionnaire.version}` : ''}
        </Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
          {/* Left: context variables that drive conditional logic */}
          <Box sx={{ width: 320, flexShrink: 0 }}>
            <Typography variant="h6" sx={{ color: '#0F347C', mb: 0.5 }}>
              Test context
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              These hidden fields are injected from the appointment/patient in production. Set them to exercise the
              conditional logic below.
            </Typography>

            {statusReferenced && (
              <TextField
                select
                size="small"
                label="Response status ($status)"
                value={status}
                onChange={(e) => setStatus(e.target.value as QuestionnaireResponse['status'])}
                fullWidth
                sx={{ mb: 1.5 }}
              >
                {STATUS_OPTIONS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </TextField>
            )}

            {contextFields.length === 0 && !statusReferenced && (
              <Typography variant="body2" color="text.secondary">
                This draft has no hidden context variables driving conditional logic.
              </Typography>
            )}

            {contextFields.map((cf) => {
              const linkId = cf.field.linkId as string;
              const options = optionsForField(cf);
              const label = cf.field.text || linkId;
              return options.length > 0 ? (
                <TextField
                  key={linkId}
                  select
                  size="small"
                  label={label}
                  helperText={linkId}
                  value={contextValues[linkId] ?? ''}
                  onChange={(e) => setValue(linkId, e.target.value)}
                  fullWidth
                  sx={{ mb: 1.5 }}
                >
                  <MenuItem value="">
                    <em>— unset —</em>
                  </MenuItem>
                  {options.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <TextField
                  key={linkId}
                  size="small"
                  type={inputTypeForField(cf.field.type)}
                  label={label}
                  helperText={linkId}
                  value={contextValues[linkId] ?? ''}
                  onChange={(e) => setValue(linkId, e.target.value)}
                  fullWidth
                  InputLabelProps={cf.field.type === 'date' ? { shrink: true } : undefined}
                  sx={{ mb: 1.5 }}
                />
              );
            })}
          </Box>

          <Divider orientation="vertical" flexItem />

          {/* Right: live preview reflecting the seeded context */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <QuestionnairePreview
              questionnaire={questionnaire}
              currentPageIndex={currentPageIndex}
              setCurrentPageIndex={setCurrentPageIndex}
              completed={completed}
              setCompleted={setCompleted}
              previewMode="ui-only"
              stubAnswersByPage={stubAnswersByPage}
              responseStatus={statusReferenced ? status : undefined}
              filterPagesByEnableWhen
            />
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
