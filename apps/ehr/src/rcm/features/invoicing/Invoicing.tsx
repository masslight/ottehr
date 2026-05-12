import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { LoadingButton, TabContext, TabList, TabPanel } from '@mui/lab';
import {
  alpha,
  Box,
  Button,
  CircularProgress,
  FormHelperText,
  Paper,
  Stack,
  Tab,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Mention from '@tiptap/extension-mention';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { PlaceholderChips } from 'src/components/template-editor-field/PlaceholderChips';
import {
  INVOICE_TOKEN_IDS,
  makeSuggestion,
  textToTiptapContent,
  tiptapContentToText,
} from 'src/components/template-editor-field/TemplateEditorField';
import {
  useGetInvoiceConfigQuery,
  useSaveInvoiceConfigMutation,
} from 'src/rcm/state/invoice-config/invoice-config.queries';
import {
  DEFAULT_INVOICE_DUE_DAYS,
  DEFAULT_INVOICE_MEMO_TEMPLATE,
  DEFAULT_INVOICE_SMS_TEMPLATE,
  fillInvoiceTemplate,
  InvoicePlaceholderInput,
  parseInvoiceConfigFromQR,
} from 'utils';

const SAMPLE_INPUT: InvoicePlaceholderInput = {
  patientFullName: 'Jane Smith',
  clinic: 'Ottehr Clinic',
  location: 'Washington, DC',
  visitDate: '2026-03-15',
  dueDate: '2026-03-29',
  amountCents: 12500,
  invoiceLink: 'https://payments.ottehr.com/inv/abc123',
  patientPortalLink: 'https://patient.ottehr.com/',
};

interface InvoicingFormValues {
  smsTemplate: string;
  memoTemplate: string;
  invoiceDueDays: number;
}

const DEFAULTS: InvoicingFormValues = {
  smsTemplate: DEFAULT_INVOICE_SMS_TEMPLATE,
  memoTemplate: DEFAULT_INVOICE_MEMO_TEMPLATE,
  invoiceDueDays: DEFAULT_INVOICE_DUE_DAYS,
};

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
// Preview
// ---------------------------------------------------------------------------

function resolveTemplate(template: string): string {
  return fillInvoiceTemplate(template, SAMPLE_INPUT);
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
              <PlaceholderChips tokens={INVOICE_TOKEN_IDS} onInsert={insertToken} />
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
  const parsed = parseInvoiceConfigFromQR(qr);
  return {
    invoiceDueDays: parsed.dueDaysFromGeneration,
    smsTemplate: parsed.defaultSmsTemplate,
    memoTemplate: parsed.defaultInvoiceMemo,
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
