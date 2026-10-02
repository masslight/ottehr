import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Alert, Box, IconButton, LinearProgress, Paper, TextField, Tooltip, Typography } from '@mui/material';
import { FC, Fragment, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { locateGeneratedLines } from './narrativeLines';
import { cutRuns } from './narrativeRuns';
import { ProvenanceContent } from './Provenance';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { AI_SURFACE } from './ScribeStage';
import { scaled } from './scribeTheme';
import { LocatedLine } from './types';

const testIds = dataTestIds.scribeRecommendations;

interface NarrativeEditorProps {
  /** Nothing can be typed while the narrative is being written or read. */
  disabled: boolean;
}

/**
 * The one-paragraph narrative the provider corrects. At rest it is a read view where each generated sentence
 * shows its transcript sources on hover (unbacked ones underlined); a click swaps in a text area at that spot.
 */
export const NarrativeEditor: FC<NarrativeEditorProps> = ({ disabled }) => {
  const draft = useScribeRecommendationsStore((state) => state.narrativeDraft);
  const generated = useScribeRecommendationsStore((state) => state.narrativeGenerated);
  const status = useScribeRecommendationsStore((state) => state.narrativeStatus);
  const error = useScribeRecommendationsStore((state) => state.narrativeError);
  const setNarrativeDraft = useScribeRecommendationsStore((state) => state.setNarrativeDraft);

  const [isEditing, setIsEditing] = useState(false);
  // Draft offset of the click that opened the editor; unset means the end of the text.
  const caretRef = useRef<number | undefined>(undefined);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const located = useMemo(() => locateGeneratedLines(draft, generated), [draft, generated]);
  // `located` holds only generated sentences still in the draft, so rewritten ones aren't flagged.
  const unbacked = useMemo(() => located.filter((line) => line.original.sources.length === 0), [located]);

  // The read view needs text to click into; while generating, the text area stands in.
  const showReadView = !isEditing && draft !== '' && status !== 'generating';

  useEffect(() => {
    if (!isEditing) return;
    const input = inputRef.current;
    if (!input) return;
    const at = caretRef.current ?? input.value.length;
    input.setSelectionRange(at, at);
  }, [isEditing]);

  const startEditing = (event?: MouseEvent<HTMLElement>): void => {
    if (disabled) return;
    caretRef.current = event ? caretOffsetAt(event.currentTarget, event.clientX, event.clientY) : undefined;
    setIsEditing(true);
  };
  const stopEditing = (): void => {
    setIsEditing(false);
  };

  return (
    <Box data-testid={testIds.narrativeEditor} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="subtitle2" sx={{ fontSize: scaled(13) }}>
          Narrative
        </Typography>
        {showReadView && (
          <IconButton
            size="small"
            onClick={() => startEditing()}
            disabled={disabled}
            aria-label="Edit narrative"
            data-testid={testIds.editNarrativeButton}
            sx={{ p: 0.5 }}
          >
            <EditOutlinedIcon sx={{ fontSize: scaled(18) }} />
          </IconButton>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary">
        The planner reads the transcript. Anything you change here is a correction it follows over the transcript — to
        leave something out, say so in a sentence rather than just deleting it.
      </Typography>

      {status === 'generating' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 0.5 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary">
            Writing the narrative from the transcript…
          </Typography>
        </Box>
      )}
      {status === 'error' && error && <Alert severity="error">{error}</Alert>}

      {showReadView ? (
        <NarrativeReadView draft={draft} located={located} disabled={disabled} onClick={startEditing} />
      ) : (
        <TextField
          value={draft}
          onChange={(event) => setNarrativeDraft(event.target.value)}
          // Focusing the empty box starts an edit, so the first keystroke does not swap it for the read view.
          onFocus={() => setIsEditing(true)}
          onBlur={stopEditing}
          onKeyDown={(event) => {
            if (event.key === 'Escape') stopEditing();
          }}
          multiline
          minRows={6}
          maxRows={18}
          fullWidth
          autoFocus={isEditing}
          inputRef={inputRef}
          placeholder="Type, dictate, or paste the narrative here — or select a transcript above to have it written for you."
          disabled={disabled}
          inputProps={{ 'data-testid': testIds.narrativeInput, 'aria-label': 'Narrative' }}
          sx={{ mt: 0.5, '& .MuiInputBase-input': { fontSize: scaled(14), lineHeight: 1.5 } }}
        />
      )}

      {unbacked.length > 0 && (
        <Typography data-testid={testIds.narrativeUnbackedNote} variant="caption" sx={{ color: 'error.main' }}>
          Red underline indicates an inexact match with transcript.
        </Typography>
      )}
    </Box>
  );
};

interface NarrativeReadViewProps {
  draft: string;
  located: LocatedLine[];
  disabled: boolean;
  onClick: (event: MouseEvent<HTMLElement>) => void;
}

/**
 * Renders the draft character for character, so a click maps back to an offset, cut into generated sentences
 * and the provider's own words between them.
 */
const NarrativeReadView: FC<NarrativeReadViewProps> = ({ draft, located, disabled, onClick }) => {
  // Located lines never overlap, so each run carries at most one id: its index into `located`.
  const runs = useMemo(
    () =>
      cutRuns(
        draft,
        located.map((line, index) => ({ start: line.start, end: line.end, id: String(index) }))
      ),
    [draft, located]
  );

  return (
    <Paper
      variant="outlined"
      data-testid={testIds.narrativeReadView}
      onClick={onClick}
      sx={{ px: 1.5, py: 1, mt: 0.5, cursor: disabled ? 'default' : 'text' }}
    >
      <Typography variant="body2" sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
        {runs.map((run, index) => {
          const id = run.itemIds?.[0];
          if (id === undefined) return <Fragment key={index}>{run.text}</Fragment>;
          const line = located[Number(id)];
          return (
            <NarrativeSentence key={index} index={Number(id)} line={line}>
              {run.text}
            </NarrativeSentence>
          );
        })}
      </Typography>
    </Paper>
  );
};

interface NarrativeSentenceProps {
  index: number;
  line: LocatedLine;
  children: string;
}

/** A generated sentence with its transcript sources on hover; unbacked sentences get a dotted underline. */
const NarrativeSentence: FC<NarrativeSentenceProps> = ({ index, line, children }) => {
  const sources = line.original.sources;
  const isUnbacked = sources.length === 0;

  return (
    <Tooltip
      title={
        !isUnbacked ? (
          <ProvenanceContent transcriptSources={sources} />
        ) : line.original.approximateSource ? (
          <ProvenanceContent evidenceOrigin="inexact" transcriptSources={[line.original.approximateSource]} />
        ) : (
          <ProvenanceContent evidenceOrigin="unbacked" />
        )
      }
      placement="top"
      arrow
      enterDelay={150}
    >
      <Box
        component="span"
        data-testid={testIds.narrativeSentence(index)}
        sx={(theme) => ({
          borderRadius: '4px',
          '&:hover': { backgroundColor: AI_SURFACE },
          ...(isUnbacked
            ? {
                textDecoration: 'underline dotted',
                textDecorationColor: theme.palette.error.main,
                textUnderlineOffset: '3px',
              }
            : {}),
        })}
      >
        {children}
      </Box>
    </Tooltip>
  );
};

/**
 * Offset into the read view's text under a point, summing the text nodes before the hit one. `undefined`
 * (no browser support, or a click off the text) means the end of the text.
 */
function caretOffsetAt(container: HTMLElement, x: number, y: number): number | undefined {
  const doc = container.ownerDocument;
  let node: Node | null = null;
  let offset = 0;
  if (typeof doc.caretPositionFromPoint === 'function') {
    const position = doc.caretPositionFromPoint(x, y);
    if (position) [node, offset] = [position.offsetNode, position.offset];
  } else if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(x, y);
    if (range) [node, offset] = [range.startContainer, range.startOffset];
  }
  if (!node || node.nodeType !== Node.TEXT_NODE || !container.contains(node)) return undefined;

  const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let before = 0;
  for (let current = walker.nextNode(); current; current = walker.nextNode()) {
    if (current === node) return before + offset;
    before += current.textContent?.length ?? 0;
  }
  return undefined;
}
