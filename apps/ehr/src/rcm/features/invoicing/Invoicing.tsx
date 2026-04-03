import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { LoadingButton, TabContext, TabList, TabPanel } from '@mui/lab';
import {
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  FormHelperText,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Switch,
  Tab,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Mention from '@tiptap/extension-mention';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { enqueueSnackbar } from 'notistack';
import React, {
  forwardRef,
  ReactElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Controller, useForm } from 'react-hook-form';
import {
  useGetInvoiceConfigQuery,
  useSaveInvoiceConfigMutation,
} from 'src/rcm/state/invoice-config/invoice-config.queries';

// Token IDs (bare, without braces) — used as Mention node attrs.id
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

const SAMPLE_VALUES: Record<string, string> = {
  '{{patient-full-name}}': 'Jane Smith',
  '{{clinic}}': 'Ottehr Clinic',
  '{{location}}': 'Washington, DC',
  '{{visit-date}}': 'Sunday, March 15, 2026',
  '{{due-date}}': 'Sunday, March 29, 2026',
  '{{amount}}': '$125.00',
  '{{invoice-link}}': 'https://payments.ottehr.com/inv/abc123',
  '{{patient-portal-link}}': 'https://patient.ottehr.com/',
};

const DEFAULT_SMS_TEMPLATE =
  "Thank you, {{patient-full-name}}, for visiting {{clinic}} at {{location}} on {{visit-date}}! You have a balance due of {{amount}}.\n\n\ud83d\udcb3 If we have your card on file, it will be billed on {{due-date}}, and no action is needed. If you'd like to use a different payment method, please pay the invoice with your preferred method before due date: {{invoice-link}}";

const DEFAULT_MEMO_TEMPLATE =
  "Thank you, {{patient-full-name}}, for visiting {{clinic}} at {{location}} on {{visit-date}}! You have a balance due of {{amount}}.\n\n\ud83d\udcb3 If we have your card on file, it will be billed on {{due-date}}, and no action is needed. If you'd like to use a different payment method, please pay the invoice with your preferred method before the due date. For more details about the visit, please, visit your patient portal, {{patient-portal-link}}";

interface InvoicingFormValues {
  smsTemplate: string;
  memoTemplate: string;
  invoiceDueDays: number;
  autoChargeOnDueDate: boolean;
}

const DEFAULTS: InvoicingFormValues = {
  smsTemplate: DEFAULT_SMS_TEMPLATE,
  memoTemplate: DEFAULT_MEMO_TEMPLATE,
  invoiceDueDays: 7,
  autoChargeOnDueDate: false,
};

// ---------------------------------------------------------------------------
// Mention suggestion dropdown (rendered via React portal)
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
      if (event.key === 'Escape') {
        return true;
      }
      return false;
    },
  }));

  if (props.items.length === 0) return null;

  return (
    <Paper elevation={4} sx={{ maxHeight: 200, overflow: 'auto', minWidth: 220 }}>
      <List dense disablePadding>
        {props.items.map((item, i) => (
          <ListItemButton
            key={item}
            selected={i === selectedIndex}
            onMouseDown={(e) => {
              e.preventDefault();
              props.command({ id: item });
            }}
          >
            <ListItemText
              primary={`{{${item}}}`}
              sx={{ '& .MuiListItemText-primary': { color: 'info.main', fontWeight: 500 } }}
            />
          </ListItemButton>
        ))}
      </List>
    </Paper>
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
          container.style.zIndex = '1300';

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
        onKeyDown: (props: SuggestionKeyDownProps) => {
          return reactRef.current?.onKeyDown(props) ?? false;
        },
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
// Tiptap ↔ plain text conversion
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
// TemplateEditor — Tiptap-based template field
// ---------------------------------------------------------------------------

function TemplateEditor({
  value,
  onChange,
  editorRef,
}: {
  value: string;
  onChange: (value: string) => void;
  editorRef: React.MutableRefObject<ReturnType<typeof useEditor> | null>;
}): ReactElement {
  const theme = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialContent = useMemo(() => textToTiptapContent(value), []);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
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

  return (
    <Box
      sx={{
        '& .tiptap': {
          outline: 'none',
          padding: '16.5px 14px',
          minHeight: 96,
          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
          fontSize: '1rem',
          lineHeight: 1.5,
          letterSpacing: '0.00938em',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
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
  );
}

// ---------------------------------------------------------------------------
// PlaceholderChips — clickable chip row for inserting tokens
// ---------------------------------------------------------------------------

function PlaceholderChips({
  tokens,
  onInsert,
}: {
  tokens: readonly string[];
  onInsert: (tokenId: string) => void;
}): ReactElement {
  return (
    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
      {tokens.map((id) => (
        <Chip
          key={id}
          label={`{{${id}}}`}
          size="small"
          variant="outlined"
          onClick={() => onInsert(id)}
          sx={(t) => ({
            cursor: 'pointer',
            color: 'info.main',
            borderColor: 'transparent',
            bgcolor: alpha(t.palette.info.main, 0.1),
          })}
        />
      ))}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

function resolveTemplate(template: string): string {
  return template.replace(/\{\{[a-z-]+\}\}/g, (match) => SAMPLE_VALUES[match] ?? match);
}

function TemplatePreview({ template }: { template: string }): ReactElement {
  const resolved = useMemo(() => resolveTemplate(template), [template]);

  return (
    <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.200' }}>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {resolved}
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// TemplateField — Write/Preview tabs wrapping a TemplateEditor
// ---------------------------------------------------------------------------

function TemplateField({
  name,
  label,
  control,
  editorRef,
}: {
  name: 'smsTemplate' | 'memoTemplate';
  label: string;
  control: ReturnType<typeof useForm<InvoicingFormValues>>['control'];
  editorRef: React.MutableRefObject<ReturnType<typeof useEditor> | null>;
}): ReactElement {
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  const insertToken = useCallback(
    (tokenId: string) => {
      const ed = editorRef.current;
      if (!ed) return;
      ed.chain()
        .focus()
        .insertContent({ type: 'mention', attrs: { id: tokenId, label: tokenId } })
        .run();
    },
    [editorRef]
  );

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        <TabContext value={tab}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
            <TabList
              onChange={(_, v: 'write' | 'preview') => setTab(v)}
              sx={{ minHeight: 36 }}
              aria-label={`${label} write/preview tabs`}
            >
              <Tab label="Write" value="write" sx={{ textTransform: 'none', minHeight: 36, py: 0.5 }} />
              <Tab label="Preview" value="preview" sx={{ textTransform: 'none', minHeight: 36, py: 0.5 }} />
            </TabList>
          </Box>
          <TabPanel value="write" sx={{ p: 0 }}>
            <Controller
              name={name}
              control={control}
              rules={{ required: `${label} is required` }}
              render={({ field }) => (
                <TemplateEditor value={field.value} onChange={field.onChange} editorRef={editorRef} />
              )}
            />
            <Box sx={{ px: 1.5, pb: 1.5 }}>
              <FormHelperText sx={{ mt: 0 }}>Type {'{{'} to insert a placeholder, or click one below</FormHelperText>
              <PlaceholderChips tokens={TOKEN_IDS} onInsert={insertToken} />
            </Box>
          </TabPanel>
          <TabPanel value="preview" sx={{ p: 0 }}>
            <Box sx={{ p: 1.5 }}>
              <Controller
                name={name}
                control={control}
                render={({ field }) => <TemplatePreview template={field.value} />}
              />
            </Box>
          </TabPanel>
        </TabContext>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// parseQuestionnaireResponse
// ---------------------------------------------------------------------------

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
): InvoicingFormValues {
  const group = qr?.item?.find((i) => i.linkId === 'invoicing');
  const items = group?.item ?? [];
  const findAnswer = (linkId: string): any => items.find((i) => i.linkId === linkId)?.answer?.[0];
  return {
    invoiceDueDays: findAnswer('invoicing.dueDaysFromGeneration')?.valueInteger ?? DEFAULTS.invoiceDueDays,
    autoChargeOnDueDate: findAnswer('invoicing.autoChargeOnDueDate')?.valueBoolean ?? DEFAULTS.autoChargeOnDueDate,
    smsTemplate: findAnswer('invoicing.defaultSmsTemplate')?.valueString ?? DEFAULTS.smsTemplate,
    memoTemplate: findAnswer('invoicing.defaultInvoiceMemo')?.valueString ?? DEFAULTS.memoTemplate,
  };
}

// ---------------------------------------------------------------------------
// Main Invoicing form
// ---------------------------------------------------------------------------

export default function Invoicing(): ReactElement {
  const { data: configData, isLoading } = useGetInvoiceConfigQuery();
  const saveMutation = useSaveInvoiceConfigMutation();

  const {
    control,
    handleSubmit,
    formState: { isDirty },
    reset,
  } = useForm<InvoicingFormValues>({ defaultValues: DEFAULTS });

  const smsEditorRef = useRef<ReturnType<typeof useEditor> | null>(null);
  const memoEditorRef = useRef<ReturnType<typeof useEditor> | null>(null);

  useEffect(() => {
    if (configData?.questionnaireResponse) {
      const values = parseQuestionnaireResponse(configData.questionnaireResponse);
      reset(values);
      // Sync Tiptap editors with the loaded values
      const smsContent = textToTiptapContent(values.smsTemplate);
      const memoContent = textToTiptapContent(values.memoTemplate);
      smsEditorRef.current?.commands.setContent(smsContent);
      memoEditorRef.current?.commands.setContent(memoContent);
    }
  }, [configData, reset]);

  const onSubmit = useCallback(
    async (data: InvoicingFormValues) => {
      try {
        await saveMutation.mutateAsync({
          dueDaysFromGeneration: data.invoiceDueDays,
          autoChargeOnDueDate: data.autoChargeOnDueDate,
          defaultSmsTemplate: data.smsTemplate,
          defaultInvoiceMemo: data.memoTemplate,
        });
        reset(data);
        enqueueSnackbar('Invoicing settings saved', { variant: 'success' });
      } catch {
        enqueueSnackbar('Failed to save invoicing settings', { variant: 'error' });
      }
    },
    [reset, saveMutation]
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Paper sx={{ padding: 3, marginTop: 2 }}>
        <Typography variant="h3" color="primary.dark" sx={{ fontWeight: '600 !important', mb: 2 }}>
          Default Invoicing Settings
        </Typography>

        <Stack direction="row" alignItems="flex-start" spacing={3} sx={{ mb: 3 }}>
          <Controller
            name="invoiceDueDays"
            control={control}
            rules={{
              required: 'Invoice due days is required',
              min: { value: 1, message: 'Must be at least 1 day' },
              max: { value: 365, message: 'Must be 365 days or fewer' },
            }}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                label="Invoice Due Days"
                type="number"
                inputProps={{ min: 1, max: 365 }}
                error={!!error}
                helperText={error?.message || 'Days until the invoice becomes due'}
                sx={{ width: 280 }}
              />
            )}
          />

          <Box>
            <Controller
              name="autoChargeOnDueDate"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch checked={field.value} onChange={field.onChange} />}
                  label="Auto-Charge on Due Date"
                />
              )}
            />
            <FormHelperText>
              When enabled, the patient&apos;s card on file is automatically charged on the invoice due date
            </FormHelperText>
          </Box>
        </Stack>

        <TemplateField
          name="smsTemplate"
          label="Default SMS Message Template"
          control={control}
          editorRef={smsEditorRef}
        />

        <TemplateField
          name="memoTemplate"
          label="Default Invoice Memo Template"
          control={control}
          editorRef={memoEditorRef}
        />

        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <LoadingButton
            type="submit"
            variant="contained"
            loading={saveMutation.isPending}
            disabled={!isDirty}
            sx={{ borderRadius: 28, textTransform: 'none', fontWeight: 'bold' }}
          >
            Save changes
          </LoadingButton>
          <Button
            variant="text"
            disabled={!isDirty || saveMutation.isPending}
            onClick={() => reset()}
            sx={{ borderRadius: 28, textTransform: 'none', fontWeight: 'bold' }}
          >
            Reset
          </Button>
        </Stack>

        {configData?.questionnaireResponse?.id && <SettingsId value={configData.questionnaireResponse.id} />}
      </Paper>
    </form>
  );
}

// ---------------------------------------------------------------------------
// SettingsId — copyable FHIR resource ID footer
// ---------------------------------------------------------------------------

function SettingsId({ value }: { value: string }): ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Tooltip title={copied ? 'Copied!' : 'Click to copy'}>
      <Typography
        variant="caption"
        color="text.disabled"
        onClick={handleCopy}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          mt: 3,
          cursor: 'pointer',
          userSelect: 'none',
          fontFamily: 'monospace',
        }}
      >
        Settings ID: {value}
        {copied ? (
          <CheckIcon sx={{ fontSize: 13, color: 'success.main' }} />
        ) : (
          <ContentCopyIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
        )}
      </Typography>
    </Tooltip>
  );
}
