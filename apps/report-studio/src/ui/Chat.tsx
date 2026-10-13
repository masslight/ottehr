import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Attachment, resetConversation, sendMessage, undoTurn } from '../llm/chat';
import { AssistantBlock, ChatItem, ChangesBlock, ToolBlock, useStudio } from '../state/store';
import { DiffView } from './DiffView';

const STARTERS = [
  'Visits by status per day for the last 30 days, as a stacked bar chart plus a table.',
  'Payer mix: visits by primary payer last 90 days, with self-pay called out.',
  'Provider productivity: visits, average length of stay and distinct patients per attending provider.',
  'Average wait time by location and hour of day.',
];

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_TEXT_CHARS = 200_000;

async function toAttachment(file: File): Promise<Attachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error(`${file.name} is larger than 20 MB`);
  const type = file.type || '';
  const base64 = async (): Promise<string> => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  };
  if (type === 'application/pdf') {
    return {
      name: file.name,
      block: {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: await base64() },
        title: file.name,
      },
    };
  }
  if (/^image\/(png|jpeg|gif|webp)$/.test(type)) {
    return {
      name: file.name,
      block: { type: 'image', source: { type: 'base64', media_type: type as 'image/png', data: await base64() } },
    };
  }
  const text = await file.text();
  return {
    name: file.name,
    block: {
      type: 'text',
      text: `<attached file name="${file.name}">\n${
        text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}\n…[truncated]` : text
      }\n</attached>`,
    },
  };
}

export function Chat(): React.ReactElement {
  const chat = useStudio((s) => s.chat);
  const busy = useStudio((s) => s.busy);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat]);

  const submit = (): void => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    const sent = attachments;
    setAttachments([]);
    void sendMessage(text, sent);
  };

  const addFiles = async (files: FileList | File[]): Promise<void> => {
    setAttachError(null);
    try {
      const added = await Promise.all(Array.from(files).map(toAttachment));
      setAttachments((a) => [...a, ...added]);
    } catch (error) {
      setAttachError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void addFiles(e.dataTransfer.files);
      }}
    >
      <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Conversation
        </Typography>
        <Box sx={{ flex: 1 }} />
        {chat.length > 0 && (
          <Button size="small" onClick={resetConversation} disabled={busy}>
            New conversation
          </Button>
        )}
      </Box>

      <Box
        ref={listRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          px: 2,
          py: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          bgcolor: dragging ? '#eef3ff' : undefined,
        }}
      >
        {chat.length === 0 && (
          <Box sx={{ color: 'text.secondary', mt: 1 }}>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              Describe the report you want, drop in a spec or a sample of an existing report (PDF, image, CSV, text), or
              open a saved one. Claude writes the fetch plan and the code, runs them against the instance, and fixes
              what it finds.
            </Typography>
            <Stack spacing={0.75}>
              {STARTERS.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  variant="outlined"
                  onClick={() => setDraft(s)}
                  sx={{
                    justifyContent: 'flex-start',
                    height: 'auto',
                    py: 0.5,
                    '& .MuiChip-label': { whiteSpace: 'normal' },
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}
        {chat.map((item) => (
          <ChatMessage key={item.id} item={item} />
        ))}
      </Box>

      <Box sx={{ borderTop: 1, borderColor: 'divider', p: 1.5 }}>
        {attachError && (
          <Alert severity="error" onClose={() => setAttachError(null)} sx={{ mb: 1 }}>
            {attachError}
          </Alert>
        )}
        {attachments.length > 0 && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mb: 1 }}>
            {attachments.map((a, i) => (
              <Chip
                key={`${a.name}-${i}`}
                size="small"
                label={a.name}
                onDelete={() => setAttachments((list) => list.filter((_, j) => j !== i))}
              />
            ))}
          </Stack>
        )}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => e.target.files && void addFiles(e.target.files)}
          />
          <Tooltip title="Attach a document (PDF, image, CSV, text)">
            <IconButton size="small" onClick={() => fileInput.current?.click()}>
              <AttachFileOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <TextField
            multiline
            minRows={1}
            maxRows={8}
            fullWidth
            placeholder={busy ? 'Claude is working…' : 'Ask for a report or a change…'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <IconButton color="primary" onClick={submit} disabled={busy || !draft.trim()}>
            {busy ? <CircularProgress size={20} /> : <SendRoundedIcon />}
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}

function ChatMessage({ item }: { item: ChatItem }): React.ReactElement {
  if (item.role === 'user') {
    return (
      <Box
        sx={{
          alignSelf: 'flex-end',
          maxWidth: '88%',
          bgcolor: 'primary.main',
          color: '#fff',
          px: 1.5,
          py: 1,
          borderRadius: 2,
          borderBottomRightRadius: 4,
        }}
      >
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {item.text}
        </Typography>
        {item.attachments.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap">
            {item.attachments.map((a) => (
              <Chip key={a} size="small" label={a} sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff' }} />
            ))}
          </Stack>
        )}
      </Box>
    );
  }
  return (
    <Box sx={{ alignSelf: 'flex-start', maxWidth: '96%', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {item.blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
      {item.streaming && item.blocks.length === 0 && <CircularProgress size={16} sx={{ ml: 1 }} />}
      {!item.streaming && item.usage && (
        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
          {item.usage.input.toLocaleString()} in · {item.usage.output.toLocaleString()} out
          {item.usage.cacheRead ? ` · ${item.usage.cacheRead.toLocaleString()} cached` : ''}
          {item.model ? ` · ${item.model}` : ''}
        </Typography>
      )}
    </Box>
  );
}

function BlockView({ block }: { block: AssistantBlock }): React.ReactElement | null {
  switch (block.type) {
    case 'text':
      return block.text ? (
        <Box
          sx={{
            bgcolor: '#fff',
            border: 1,
            borderColor: 'divider',
            px: 1.5,
            py: 0.25,
            borderRadius: 2,
            borderBottomLeftRadius: 4,
            fontSize: 13.5,
            lineHeight: 1.5,
            '& p': { my: 0.75 },
            '& ul, & ol': { my: 0.5, pl: 2.5 },
            '& li': { mb: 0.25 },
            '& code': {
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: 12,
              bgcolor: '#f3f5f9',
              px: 0.5,
              borderRadius: 0.5,
            },
            '& pre': { bgcolor: '#f3f5f9', p: 1, borderRadius: 1, overflow: 'auto', fontSize: 12 },
            '& h1, & h2, & h3': { fontSize: 14, fontWeight: 600, my: 1 },
          }}
        >
          <ReactMarkdown>{block.text}</ReactMarkdown>
        </Box>
      ) : null;
    case 'thinking':
      return block.text ? <Expandable label="Thinking" tone="muted" body={block.text} /> : null;
    case 'tool':
      return <ToolView block={block} />;
    case 'changes':
      return <ChangesView block={block} />;
    case 'notice':
      return (
        <Alert severity={block.tone === 'error' ? 'error' : block.tone === 'warn' ? 'warning' : 'info'} sx={{ py: 0 }}>
          {block.text}
        </Alert>
      );
    default:
      return null;
  }
}

const TOOL_LABELS: Record<string, string> = {
  get_report_state: 'Reading the report',
  update_report: 'Updating the report',
  run_report: 'Running the report',
  run_fetch: 'Exploring the data',
  inspect_data: 'Inspecting fetched data',
  list_saved_reports: 'Listing saved reports',
  get_saved_report: 'Reading a saved report',
};

function ToolView({ block }: { block: ToolBlock }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const inputText =
    typeof block.input === 'string'
      ? block.input
      : block.input === undefined
      ? ''
      : JSON.stringify(block.input, null, 1);
  const resultHead = block.result ? summarizeResult(block.name, block.result) : undefined;
  return (
    <Box
      sx={{
        border: 1,
        borderColor: block.status === 'error' ? 'error.light' : 'divider',
        borderRadius: 1.5,
        bgcolor: '#fbfcfe',
        overflow: 'hidden',
      }}
    >
      <Box
        onClick={() => setOpen((o) => !o)}
        sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.6, cursor: 'pointer' }}
      >
        {block.status === 'running' ? (
          <CircularProgress size={12} />
        ) : (
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: block.status === 'error' ? 'error.main' : 'success.main',
            }}
          />
        )}
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {TOOL_LABELS[block.name] ?? block.name}
        </Typography>
        {resultHead && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
            {resultHead}
          </Typography>
        )}
        {block.ms !== undefined && (
          <Typography variant="caption" color="text.secondary">
            {(block.ms / 1000).toFixed(1)}s
          </Typography>
        )}
        <ExpandMoreIcon
          fontSize="small"
          sx={{ transform: open ? 'rotate(180deg)' : undefined, color: 'text.secondary' }}
        />
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 1.25, pb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            input
          </Typography>
          <Pre text={inputText} />
          {block.result && (
            <>
              <Typography variant="caption" color="text.secondary">
                result
              </Typography>
              <Pre text={block.result} />
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

function summarizeResult(name: string, result: string): string {
  try {
    const parsed = JSON.parse(result) as Record<string, unknown>;
    if (name === 'run_report' || name === 'run_fetch') {
      const fetch = (parsed.fetch ?? parsed) as { totalMs?: number; steps?: { count: number; error?: string }[] };
      const steps = fetch.steps ?? [];
      const count = steps.reduce((n, s) => n + (s.count ?? 0), 0);
      const errors = steps.filter((s) => s.error).length;
      const render = parsed.render as { ok?: boolean; error?: string } | undefined;
      return `${count.toLocaleString()} resources in ${fetch.totalMs ?? '?'} ms${
        errors ? `, ${errors} step error(s)` : ''
      }${render ? (render.ok ? ', rendered' : `, render failed: ${render.error}`) : ''}`;
    }
    if (name === 'update_report')
      return parsed.ok
        ? `changed ${(parsed.changed as string[]).join(', ')}`
        : `rejected: ${(parsed.errors as string[]).join('; ')}`;
    if (Array.isArray(parsed)) return `${parsed.length} item(s)`;
  } catch {
    // not JSON
  }
  return result.length > 80 ? `${result.slice(0, 80)}…` : result;
}

function ChangesView({ block }: { block: ChangesBlock }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const busy = useStudio((s) => s.busy);
  return (
    <Box
      sx={{
        border: 1,
        borderColor: '#cfe0ff',
        bgcolor: '#f3f7ff',
        borderRadius: 1.5,
        overflow: 'hidden',
        opacity: block.undone ? 0.6 : 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.6 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, flex: 1 }}>
          {block.undone ? 'Undone: ' : 'Changed: '}
          {block.summary.join(', ')}
        </Typography>
        <Button
          size="small"
          onClick={() => setOpen((o) => !o)}
          endIcon={<ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : undefined }} />}
        >
          diff
        </Button>
        {!block.undone && (
          <Button
            size="small"
            startIcon={<UndoRoundedIcon />}
            disabled={busy}
            onClick={() => {
              undoTurn(block.before);
              useStudio.setState((s) => ({
                chat: s.chat.map((c) =>
                  c.role === 'assistant'
                    ? { ...c, blocks: c.blocks.map((b) => (b === block ? { ...b, undone: true } : b)) }
                    : c
                ),
              }));
            }}
          >
            Undo
          </Button>
        )}
      </Box>
      <Collapse in={open}>
        <Stack spacing={1} sx={{ px: 1.25, pb: 1 }}>
          {block.diffs.map((d) => (
            <Box key={d.label}>
              <Typography variant="caption" color="text.secondary">
                {d.label}
              </Typography>
              <DiffView patch={d.patch} />
            </Box>
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}

function Expandable({ label, body, tone }: { label: string; body: string; tone: 'muted' }): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ color: tone === 'muted' ? 'text.secondary' : undefined }}>
      <Button
        size="small"
        onClick={() => setOpen((o) => !o)}
        sx={{ color: 'text.secondary', px: 0.5, minWidth: 0 }}
        endIcon={<ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : undefined }} />}
      >
        {label}
      </Button>
      <Collapse in={open}>
        <Typography variant="caption" sx={{ display: 'block', whiteSpace: 'pre-wrap', px: 1, fontStyle: 'italic' }}>
          {body}
        </Typography>
      </Collapse>
    </Box>
  );
}

function Pre({ text }: { text: string }): React.ReactElement {
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        mb: 0.5,
        p: 1,
        fontSize: 11,
        lineHeight: 1.4,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        bgcolor: '#fff',
        border: '1px solid #e6e9ef',
        borderRadius: 1,
        overflow: 'auto',
        maxHeight: 260,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {text.length > 20000 ? `${text.slice(0, 20000)}\n…` : text}
    </Box>
  );
}
