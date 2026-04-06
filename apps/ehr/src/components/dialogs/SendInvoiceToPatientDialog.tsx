import CloseIcon from '@mui/icons-material/Close';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import {
  alpha,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormHelperText,
  Grid,
  IconButton,
  Skeleton,
  Tab,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Mention from '@tiptap/extension-mention';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { forwardRef, ReactElement, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Controller, useForm } from 'react-hook-form';
import { useGetInvoiceConfigQuery } from 'src/rcm/state/invoice-config/invoice-config.queries';
import {
  BRANDING_CONFIG,
  DEFAULT_INVOICE_DUE_DAYS,
  DEFAULT_INVOICE_MEMO_TEMPLATE,
  DEFAULT_INVOICE_SMS_TEMPLATE,
  InvoiceablePatientReport,
  InvoiceTaskInput,
  parseInvoiceTaskInput,
  REQUIRED_FIELD_ERROR_MESSAGE,
} from 'utils';
import { BasicDatePicker } from '../form';
import { RoundedButton } from '../RoundedButton';

// ---------------------------------------------------------------------------
// Token IDs & defaults (matching Invoicing.tsx)
// ---------------------------------------------------------------------------

const TOKEN_IDS = [
  'patient-full-name',
  'clinic',
  'location',
  'visit-date',
  'due-date',
  'amount',
  'invoice-link',
  'patient-portal-link',
] as const;

// ---------------------------------------------------------------------------
// Parse invoice config from FHIR QuestionnaireResponse
// ---------------------------------------------------------------------------

interface InvoiceConfigValues {
  smsTemplate: string;
  memoTemplate: string;
  dueDays: number;
}

function parseQuestionnaireResponse(
  qr:
    | {
        item?: {
          linkId: string;
          item?: {
            linkId: string;
            answer?: { valueInteger?: number; valueBoolean?: boolean; valueString?: string }[];
          }[];
        }[];
      }
    | undefined
): InvoiceConfigValues {
  const group = qr?.item?.find((i) => i.linkId === 'invoicing');
  const items = group?.item ?? [];
  const findAnswer = (linkId: string): any => items.find((i) => i.linkId === linkId)?.answer?.[0];
  return {
    dueDays: findAnswer('invoicing.dueDaysFromGeneration')?.valueInteger ?? DEFAULT_INVOICE_DUE_DAYS,
    smsTemplate: findAnswer('invoicing.defaultSmsTemplate')?.valueString ?? DEFAULT_INVOICE_SMS_TEMPLATE,
    memoTemplate: findAnswer('invoicing.defaultInvoiceMemo')?.valueString ?? DEFAULT_INVOICE_MEMO_TEMPLATE,
  };
}

// ---------------------------------------------------------------------------
// Tiptap ↔ plain text conversion (same as Invoicing.tsx)
// ---------------------------------------------------------------------------

function textToTiptapContent(text: string): Record<string, unknown> {
  const lines = text.split('\n');
  const paragraphs = lines.map((line) => {
    if (!line) return { type: 'paragraph' };
    const content: Record<string, unknown>[] = [];
    const regex = /\{\{([a-z-]+)\}\}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        content.push({ type: 'text', text: line.slice(lastIndex, match.index) });
      }
      content.push({ type: 'mention', attrs: { id: match[1], label: match[1] } });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < line.length) {
      content.push({ type: 'text', text: line.slice(lastIndex) });
    }
    return content.length > 0 ? { type: 'paragraph', content } : { type: 'paragraph' };
  });
  return { type: 'doc', content: paragraphs };
}

function tiptapContentToText(doc: Record<string, unknown>): string {
  const content = (doc.content ?? []) as Record<string, unknown>[];
  return content
    .map((paragraph) => {
      const nodes = (paragraph.content ?? []) as Record<string, unknown>[];
      return nodes
        .map((node) => {
          if (node.type === 'mention') {
            const attrs = node.attrs as { id?: string };
            return `{{${attrs.id ?? ''}}}`;
          }
          return (node.text as string) ?? '';
        })
        .join('');
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// Mention suggestion dropdown
// ---------------------------------------------------------------------------

interface MentionListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const MentionList = forwardRef<MentionListRef, SuggestionProps<string>>(function MentionList(props, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i - 1 + props.items.length) % props.items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % props.items.length);
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = props.items[selectedIndex];
        if (item) props.command({ id: item });
        return true;
      }
      if (event.key === 'Escape') return true;
      return false;
    },
  }));

  if (props.items.length === 0) return null;

  return (
    <Box sx={{ maxHeight: 200, overflow: 'auto', minWidth: 220, bgcolor: 'background.paper', boxShadow: 4 }}>
      {props.items.map((item, i) => (
        <Box
          key={item}
          sx={{
            px: 1.5,
            py: 0.75,
            cursor: 'pointer',
            bgcolor: i === selectedIndex ? 'action.selected' : 'transparent',
            '&:hover': { bgcolor: 'action.hover' },
            color: 'info.main',
            fontWeight: 500,
            fontSize: '0.875rem',
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            props.command({ id: item });
          }}
        >
          {`{{${item}}}`}
        </Box>
      ))}
    </Box>
  );
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeSuggestion() {
  return {
    char: '{{',
    items: ({ query }: { query: string }) => {
      const q = query.toLowerCase();
      return TOKEN_IDS.filter((id) => id.toLowerCase().includes(q));
    },
    render: () => {
      let container: HTMLDivElement | null = null;
      let root: Root | null = null;
      const reactRef = { current: null as MentionListRef | null };

      return {
        onStart: (props: SuggestionProps<string>) => {
          container = document.createElement('div');
          container.style.position = 'absolute';
          container.style.zIndex = '1400';
          const rect = props.clientRect?.();
          if (rect) {
            container.style.top = `${rect.bottom + window.scrollY}px`;
            container.style.left = `${rect.left + window.scrollX}px`;
          }
          document.body.appendChild(container);
          root = createRoot(container);
          root.render(<MentionList {...props} ref={reactRef} />);
        },
        onUpdate: (props: SuggestionProps<string>) => {
          const rect = props.clientRect?.();
          if (container && rect) {
            container.style.top = `${rect.bottom + window.scrollY}px`;
            container.style.left = `${rect.left + window.scrollX}px`;
          }
          root?.render(<MentionList {...props} ref={reactRef} />);
        },
        onKeyDown: (props: SuggestionKeyDownProps) => reactRef.current?.onKeyDown(props) ?? false,
        onExit: () => {
          root?.unmount();
          container?.remove();
          container = null;
          root = null;
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Tiptap Template Editor with Write / Preview tabs
// ---------------------------------------------------------------------------

function TemplateEditorField({
  label,
  value,
  onChange,
  editorRef,
  previewValues,
  disabled,
  required,
  error,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  editorRef: React.MutableRefObject<ReturnType<typeof useEditor> | null>;
  previewValues: Record<string, string>;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
}): ReactElement {
  const theme = useTheme();
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialContent = useMemo(() => textToTiptapContent(value), []);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        bold: false,
        italic: false,
        strike: false,
      }),
      Mention.configure({
        HTMLAttributes: { class: 'mention-token' },
        renderText: ({ node }) => `{{${node.attrs.id}}}`,
        renderHTML: ({ options, node }) => [
          'span',
          { ...options.HTMLAttributes, 'data-type': 'mention' },
          `{{${node.attrs.label ?? node.attrs.id}}}`,
        ],
        suggestion: makeSuggestion(),
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor: ed }) => {
      const text = tiptapContentToText(ed.getJSON());
      onChangeRef.current(text);
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor, editorRef]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const resolvedPreview = useMemo(() => {
    return value.replace(/\{\{([a-z-]+)\}\}/g, (full, id) => previewValues[id] ?? full);
  }, [value, previewValues]);

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {label}
        {required && (
          <Typography component="span" color="error" sx={{ ml: 0.25 }}>
            *
          </Typography>
        )}
      </Typography>
      <Box
        sx={{ border: '1px solid', borderColor: error ? 'error.main' : 'divider', borderRadius: 1, overflow: 'hidden' }}
      >
        <TabContext value={tab}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
            <TabList
              onChange={(_, v: 'write' | 'preview') => setTab(v)}
              sx={{ minHeight: 32 }}
              aria-label={`${label} tabs`}
            >
              <Tab label="Write" value="write" sx={{ textTransform: 'none', minHeight: 32, py: 0.25 }} />
              <Tab label="Preview" value="preview" sx={{ textTransform: 'none', minHeight: 32, py: 0.25 }} />
            </TabList>
          </Box>
          <TabPanel value="write" sx={{ p: 0 }}>
            <Box
              sx={{
                '& .tiptap': {
                  outline: 'none',
                  padding: '12px 14px',
                  minHeight: 80,
                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  opacity: disabled ? 0.5 : 1,
                },
                '& .tiptap p': { margin: 0 },
                '& .mention-token': {
                  color: theme.palette.info.main,
                  backgroundColor: alpha(theme.palette.info.main, 0.1),
                  borderRadius: '4px',
                  px: '4px',
                  fontWeight: 500,
                },
              }}
            >
              <EditorContent editor={editor} />
            </Box>
          </TabPanel>
          <TabPanel value="preview" sx={{ p: 0 }}>
            <Box
              sx={{
                p: 2,
                bgcolor: 'grey.50',
                borderRadius: 1,
                m: 1,
                border: '1px solid',
                borderColor: 'grey.200',
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {resolvedPreview}
              </Typography>
            </Box>
          </TabPanel>
        </TabContext>
      </Box>
      {helperText && <FormHelperText error={error}>{helperText}</FormHelperText>}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

export interface SendInvoiceFormData {
  amount: number;
  dueDate: string;
  memo: string;
  smsTextMessage: string;
}

interface SendInvoiceToPatientDialogProps {
  title: string;
  modalOpen: boolean;
  handleClose: () => void;
  onSubmit: (taskId: string, prefilledInvoiceInfo: InvoiceTaskInput) => Promise<void>;
  submitButtonName: string;
  report?: InvoiceablePatientReport;
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export default function SendInvoiceToPatientDialog({
  title,
  modalOpen,
  handleClose,
  onSubmit,
  submitButtonName,
  report,
}: SendInvoiceToPatientDialogProps): ReactElement {
  const [disableAllFields, setDisableAllFields] = useState(true);
  const { data: configData } = useGetInvoiceConfigQuery();

  const {
    control,
    watch,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SendInvoiceFormData>({
    mode: 'onBlur',
  });

  const { visitDate, location, patient, task, responsibleParty } = report ?? {};

  const smsEditorRef = useRef<ReturnType<typeof useEditor> | null>(null);
  const memoEditorRef = useRef<ReturnType<typeof useEditor> | null>(null);

  // Build preview values from real report data + current form values
  const previewValues = useMemo<Record<string, string>>(() => {
    const amount = watch('amount');
    const dueDate = watch('dueDate');
    const formatDate = (raw: string | undefined): string => {
      if (!raw) return '';
      const dt = DateTime.fromISO(raw);
      if (dt.isValid) return dt.toFormat('EEEE, MMMM d, yyyy');
      const dtUs = DateTime.fromFormat(raw, 'MM/dd/yyyy');
      if (dtUs.isValid) return dtUs.toFormat('EEEE, MMMM d, yyyy');
      return raw;
    };
    return {
      'patient-full-name': patient?.fullName ?? '',
      clinic: BRANDING_CONFIG.projectName,
      location: location ?? '',
      'visit-date': formatDate(visitDate),
      'due-date': formatDate(dueDate),
      amount: amount
        ? `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '',
      'invoice-link': 'https://example.com/invoice-link',
      'patient-portal-link': 'https://example.com/patient-portal',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.fullName, location, visitDate, watch('amount'), watch('dueDate')]);

  // Pre-fill form when task data + config arrive
  useEffect(() => {
    if (!task) return;
    try {
      const invoiceTaskInput = parseInvoiceTaskInput(task);
      if (!invoiceTaskInput) return;

      const config = configData?.questionnaireResponse
        ? parseQuestionnaireResponse(configData.questionnaireResponse)
        : undefined;

      const { amountCents } = invoiceTaskInput;
      const dueDays = config?.dueDays ?? DEFAULT_INVOICE_DUE_DAYS;
      const dueDate = DateTime.now().plus({ days: dueDays }).toISODate();
      const smsTemplate = config?.smsTemplate ?? DEFAULT_INVOICE_SMS_TEMPLATE;
      const memoTemplate = config?.memoTemplate ?? DEFAULT_INVOICE_MEMO_TEMPLATE;

      reset({
        amount: (amountCents ?? 0) / 100,
        dueDate: dueDate,
        memo: memoTemplate,
        smsTextMessage: smsTemplate,
      });

      // Sync Tiptap editors
      smsEditorRef.current?.commands.setContent(textToTiptapContent(smsTemplate));
      memoEditorRef.current?.commands.setContent(textToTiptapContent(memoTemplate));

      setDisableAllFields(false);
    } catch {
      /* empty */
    }
  }, [task, reset, configData]);

  const handleSubmitWrapped = (data: SendInvoiceFormData): void => {
    if (task && task?.id) {
      setDisableAllFields(true);
      void onSubmit(task.id, {
        dueDate: data.dueDate,
        memo: data.memo,
        smsTextMessage: data.smsTextMessage,
        amountCents: Math.round(data.amount * 100),
      });
    } else enqueueSnackbar('Error sending invoice', { variant: 'error' });
  };

  return (
    <Dialog open={modalOpen} maxWidth="md" fullWidth>
      <IconButton onClick={() => handleClose()} size="medium" sx={{ position: 'absolute', right: 12, top: 12 }}>
        <CloseIcon fontSize="medium" sx={{ color: '#938B7D' }} />
      </IconButton>

      <Grid container direction="column" sx={{ padding: 1 }} spacing={0.5}>
        <DialogTitle variant="h4" color="primary.dark">
          {title}
        </DialogTitle>

        <DialogContent>
          {report !== undefined ? (
            <Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Patient
                </Typography>
                <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{patient?.fullName}</Typography>
                <Box sx={{ flexDirection: 'row', display: 'flex' }}>
                  <Typography variant="body2">{patient?.dob}</Typography>
                  <Typography variant="body2" sx={{ pl: 2 }}>
                    {patient?.gender}
                  </Typography>
                  <Typography variant="body2" sx={{ pl: 2 }}>
                    {patient?.phoneNumber}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mt: 2, mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Responsible party name
                </Typography>
                <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{responsibleParty?.fullName}</Typography>
                <Box sx={{ flexDirection: 'row', display: 'flex' }}>
                  <Typography variant="body2">{responsibleParty?.email}</Typography>
                  <Typography variant="body2" sx={{ pl: 2 }}>
                    {responsibleParty?.phoneNumber}
                  </Typography>
                </Box>
              </Box>
            </Box>
          ) : (
            <Skeleton variant="rectangular" animation="wave" />
          )}

          <Grid
            component="form"
            id="send-invoice-form"
            container
            spacing={2}
            onSubmit={handleSubmit(handleSubmitWrapped)}
          >
            <Grid item xs={12} sm={6}>
              <Controller
                name="amount"
                control={control}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                  min: { value: 0.01, message: 'Amount must be greater than 0' },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="number"
                    label="Amount, $"
                    error={!!errors.amount}
                    helperText={errors.amount?.message}
                    required
                    disabled={disableAllFields}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <BasicDatePicker
                name="dueDate"
                label="Due date"
                variant="outlined"
                control={control}
                rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                component="Picker"
                disabled={disableAllFields}
                disablePast={true}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="smsTextMessage"
                control={control}
                rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                disabled={disableAllFields}
                render={({ field, fieldState }) => (
                  <TemplateEditorField
                    label="SMS message"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    editorRef={smsEditorRef}
                    previewValues={previewValues}
                    disabled={disableAllFields}
                    required
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="memo"
                control={control}
                rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                disabled={disableAllFields}
                render={({ field, fieldState }) => (
                  <TemplateEditorField
                    label="Invoice memo"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    editorRef={memoEditorRef}
                    previewValues={previewValues}
                    disabled={disableAllFields}
                    required
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              width: '100%',
              marginX: 2,
              mb: 1,
            }}
          >
            <RoundedButton variant="outlined" onClick={handleClose} size="medium">
              Cancel
            </RoundedButton>
            <RoundedButton
              disabled={disableAllFields}
              loading={isSubmitting}
              form="send-invoice-form"
              type="submit"
              variant="contained"
              color="primary"
            >
              {submitButtonName}
            </RoundedButton>
          </Box>
        </DialogActions>
      </Grid>
    </Dialog>
  );
}
