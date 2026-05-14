import { TabContext, TabList, TabPanel } from '@mui/lab';
import { alpha, Box, FormHelperText, List, ListItemButton, ListItemText, Paper, Tab, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Extension } from '@tiptap/core';
import Mention from '@tiptap/extension-mention';
import { Plugin } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { SuggestionKeyDownProps, SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import React, { forwardRef, ReactElement, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { convertMarkdownLinksToHtml, replaceTemplateVariablesHandlebars } from 'utils';

// ---------------------------------------------------------------------------
// Token IDs (bare, without braces) — used as Mention node attrs.id
// ---------------------------------------------------------------------------

export const INVOICE_TOKEN_IDS = [
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
// Tiptap ↔ plain text conversion
// ---------------------------------------------------------------------------

export function textToTiptapContent(text: string): Record<string, unknown> {
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

export function tiptapContentToText(doc: Record<string, unknown>): string {
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
// MaxLength enforcement — reject transactions that would push the rendered
// plain text past the limit. Counts mentions as their `{{token-id}}` form
// (via tiptapContentToText) so the cap matches the eventual SMS body length.
// Filtering at the transaction level preserves cursor position and also
// blocks programmatic inserts (e.g. clicking a placeholder chip).
// ---------------------------------------------------------------------------

const MaxLengthExtension = Extension.create<{ getMaxLength: () => number | undefined }>({
  name: 'templateEditorMaxLength',
  addOptions() {
    return { getMaxLength: () => undefined };
  },
  addProseMirrorPlugins() {
    const getMaxLength = this.options.getMaxLength;
    return [
      new Plugin({
        filterTransaction: (transaction) => {
          const limit = getMaxLength();
          if (limit === undefined || !transaction.docChanged) return true;
          const text = tiptapContentToText(transaction.doc.toJSON() as Record<string, unknown>);
          return text.length <= limit;
        },
      }),
    ];
  },
});

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
      if (event.key === 'Escape') return true;
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

export function makeSuggestion(
  tokens: readonly string[] = INVOICE_TOKEN_IDS
): Omit<SuggestionOptions<string>, 'editor'> {
  return {
    char: '{{',
    items: ({ query }: { query: string }) => {
      const q = query.toLowerCase();
      return tokens.filter((id) => id.toLowerCase().includes(q));
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
// TemplateEditorField — Tiptap editor with Write/Preview tabs
// ---------------------------------------------------------------------------

export interface TemplateEditorFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  editorRef: React.MutableRefObject<ReturnType<typeof useEditor> | null>;
  previewValues?: Record<string, string>;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  /** When true, render markdown links [text](url) as clickable <a> tags in preview. */
  renderHtmlPreview?: boolean;
  tokens?: readonly string[];
  writeFooter?: React.ReactNode;
  maxLength?: number;
}

export function TemplateEditorField({
  label,
  value,
  onChange,
  editorRef,
  previewValues,
  disabled,
  required,
  error,
  helperText,
  renderHtmlPreview,
  tokens = INVOICE_TOKEN_IDS,
  writeFooter,
  maxLength,
}: TemplateEditorFieldProps): ReactElement {
  const theme = useTheme();
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialContent = useMemo(() => textToTiptapContent(value), []);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const maxLengthRef = useRef(maxLength);
  maxLengthRef.current = maxLength;

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
        suggestion: makeSuggestion(tokens),
      }),
      MaxLengthExtension.configure({ getMaxLength: () => maxLengthRef.current }),
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
    if (!previewValues) return value;
    return replaceTemplateVariablesHandlebars(value, previewValues);
  }, [value, previewValues]);

  return (
    <Box>
      {label && (
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          {label}
          {required && (
            <Typography component="span" color="error" sx={{ ml: 0.25 }}>
              *
            </Typography>
          )}
        </Typography>
      )}
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
            {writeFooter && <Box sx={{ px: 1.5, pb: 1.5 }}>{writeFooter}</Box>}
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
              {renderHtmlPreview ? (
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: 'pre-wrap', '& a': { color: 'primary.main' } }}
                  dangerouslySetInnerHTML={{ __html: convertMarkdownLinksToHtml(resolvedPreview) }}
                />
              ) : (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {resolvedPreview}
                </Typography>
              )}
            </Box>
          </TabPanel>
        </TabContext>
      </Box>
      {helperText && <FormHelperText error={error}>{helperText}</FormHelperText>}
    </Box>
  );
}
