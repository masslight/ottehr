import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import UndoIcon from '@mui/icons-material/Undo';
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, Typography } from '@mui/material';
import { compare, getValueByPointer, Operation } from 'fast-json-patch';
import { FC, useMemo } from 'react';

export type DiffKind = 'added' | 'removed' | 'changed';

export interface DiffRow {
  kind: DiffKind;
  path: string;
  before?: unknown;
  after?: unknown;
}

interface JsonDiffViewProps {
  current: unknown;
  draft: unknown;
  // When provided, each diff card (except the required version bump) gets a "Discard change" button
  // that reverts that single path in the draft back to the current value.
  onDiscard?: (row: DiffRow) => void;
}

// Diffs are noise for these keys — every draft differs from the active resource here, and it never
// reflects a meaningful content change. Stripped from both sides before diffing (see stripDiffNoise).
const IGNORED_PATHS: ReadonlyArray<(doc: Record<string, any>) => void> = [
  (doc) => delete doc.id,
  (doc) => {
    if (doc.meta && typeof doc.meta === 'object') {
      delete doc.meta.versionId;
      delete doc.meta.lastUpdated;
      if (Object.keys(doc.meta).length === 0) delete doc.meta;
    }
  },
];

// The version bump is required, so reverting it is never allowed — no discard button on this card.
const NON_DISCARDABLE_PATHS = new Set<string>(['/version']);

const KIND_STYLES: Record<DiffKind, { label: string; color: string; bg: string }> = {
  added: { label: 'Added', color: '#1B5E20', bg: 'rgba(46, 125, 50, 0.12)' },
  removed: { label: 'Removed', color: '#B71C1C', bg: 'rgba(211, 47, 47, 0.12)' },
  changed: { label: 'Changed', color: '#E65100', bg: 'rgba(237, 108, 2, 0.12)' },
};

const MAX_VALUE_CHARS = 400;

const formatValue = (value: unknown): string => {
  if (value === undefined) return '(none)';
  const str = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return str.length > MAX_VALUE_CHARS ? `${str.slice(0, MAX_VALUE_CHARS)}…` : str;
};

/** Returns a deep clone with the ignored (noise) keys removed, so they never surface as diffs. */
const stripDiffNoise = (doc: unknown): unknown => {
  if (typeof doc !== 'object' || doc === null) return doc;
  const clone = structuredClone(doc) as Record<string, any>;
  IGNORED_PATHS.forEach((strip) => strip(clone));
  return clone;
};

const toDiffRows = (current: unknown, ops: Operation[]): DiffRow[] =>
  ops.map((op) => {
    if (op.op === 'add') {
      return { kind: 'added', path: op.path, after: (op as { value?: unknown }).value };
    }
    if (op.op === 'remove') {
      return { kind: 'removed', path: op.path, before: safeGet(current, op.path) };
    }
    if (op.op === 'replace') {
      return {
        kind: 'changed',
        path: op.path,
        before: safeGet(current, op.path),
        after: (op as { value?: unknown }).value,
      };
    }
    // move/copy/test — represent generically as "changed"
    return { kind: 'changed', path: op.path };
  });

const safeGet = (document: unknown, pointer: string): unknown => {
  try {
    return getValueByPointer(document as object, pointer);
  } catch {
    return undefined;
  }
};

/**
 * Shows a structured diff between the current active questionnaire and an imported/saved draft, using a
 * JSON Patch (fast-json-patch) so every change is a precise path + before/after. `id`, `meta.versionId`,
 * and `meta.lastUpdated` are ignored. When `onDiscard` is supplied each card (except the version bump)
 * can revert its single change. A collapsible raw view of the full draft JSON is included beneath.
 */
export const JsonDiffView: FC<JsonDiffViewProps> = ({ current, draft, onDiscard }) => {
  const rows = useMemo(() => {
    const strippedCurrent = stripDiffNoise(current);
    const strippedDraft = stripDiffNoise(draft);
    // before/after values are read from the (noise-stripped) current; item pointer paths are unaffected.
    return toDiffRows(strippedCurrent, compare(strippedCurrent as object, strippedDraft as object));
  }, [current, draft]);

  return (
    <Box>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
          No differences between the current version and this draft.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {rows.length} change{rows.length === 1 ? '' : 's'}
          </Typography>
          {rows.map((row, i) => {
            const style = KIND_STYLES[row.kind];
            const canDiscard = !!onDiscard && !NON_DISCARDABLE_PATHS.has(row.path);
            return (
              <Box key={`${row.path}-${i}`} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip
                    label={style.label}
                    size="small"
                    sx={{
                      borderRadius: '4px',
                      height: '18px',
                      fontSize: 11,
                      fontWeight: 600,
                      backgroundColor: style.bg,
                      color: style.color,
                    }}
                  />
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', flexGrow: 1 }}>
                    {row.path}
                  </Typography>
                  {canDiscard && (
                    <Button
                      size="small"
                      startIcon={<UndoIcon sx={{ fontSize: 14 }} />}
                      onClick={() => onDiscard?.(row)}
                      sx={{ flexShrink: 0, textTransform: 'none', minWidth: 'auto' }}
                    >
                      Discard change
                    </Button>
                  )}
                </Box>
                {row.kind !== 'added' && <DiffValue label="Before" value={row.before} color="#B71C1C" />}
                {row.kind !== 'removed' && <DiffValue label="After" value={row.after} color="#1B5E20" />}
              </Box>
            );
          })}
        </Box>
      )}

      <Accordion variant="outlined" sx={{ mt: 1.5, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2">View full draft JSON</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box
            component="pre"
            sx={{
              fontSize: 12,
              fontFamily: 'monospace',
              bgcolor: '#f5f5f5',
              p: 1.5,
              borderRadius: 1,
              overflow: 'auto',
              maxHeight: 400,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              m: 0,
            }}
          >
            {JSON.stringify(draft, null, 2)}
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

const DiffValue: FC<{ label: string; value: unknown; color: string }> = ({ label, value, color }) => (
  <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
    <Typography variant="caption" sx={{ color, fontWeight: 600, minWidth: 48 }}>
      {label}
    </Typography>
    <Box
      component="pre"
      sx={{ fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', m: 0, flex: 1 }}
    >
      {formatValue(value)}
    </Box>
  </Box>
);
