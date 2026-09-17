import { Alert, Box, Button, LinearProgress, Paper, TextField, Tooltip, Typography } from '@mui/material';
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
  /** Nothing can be typed or regenerated while the narrative is being written or read. */
  disabled: boolean;
  /** Writes the narrative from the transcript again, replacing the draft. */
  onRegenerate: () => void;
  /** The transcript snippets behind the sentence under the pointer; `undefined` once it leaves. */
  onHoverSources?: (sources: string[] | undefined) => void;
}

/**
 * The narrative, one paragraph, as the provider corrects it before the planner reads it.
 *
 * The planner reads the transcript; what it takes from here is the provider's corrections, so it is where a
 * wrong reading of the transcript gets fixed and where anything that shouldn't be charted gets said so. It is
 * one paragraph rather than a list of sentences: a column of fields read as suggestions to pick from, not a
 * narrative to correct.
 *
 * It is shown two ways. At rest it is READ: the same paragraph, with each generated sentence a run that
 * shows the transcript words it was written from on hover — a text area has nothing to hover — and the ones
 * the generator said with nothing in the transcript to show for it underlined, so they can be found without
 * hovering. Clicking into it (or "Edit") swaps in the text area, with the caret where the click landed, and
 * leaving the text area swaps the read view back. The generated sentences are found again in the draft as it
 * is edited, and the unbacked ones are also called out beneath, so they can be checked without leaving the text.
 */
export const NarrativeEditor: FC<NarrativeEditorProps> = ({ disabled, onRegenerate, onHoverSources }) => {
  const draft = useScribeRecommendationsStore((state) => state.narrativeDraft);
  const generated = useScribeRecommendationsStore((state) => state.narrativeGenerated);
  const status = useScribeRecommendationsStore((state) => state.narrativeStatus);
  const error = useScribeRecommendationsStore((state) => state.narrativeError);
  const hasTranscript = useScribeRecommendationsStore((state) => state.transcript.trim() !== '');
  const setNarrativeDraft = useScribeRecommendationsStore((state) => state.setNarrativeDraft);

  const [isEditing, setIsEditing] = useState(false);
  // Where the click that opened the editor landed, as an offset into the draft; the text area puts its caret
  // there once it is up. Unset means the end of the text.
  const caretRef = useRef<number | undefined>(undefined);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const located = useMemo(() => locateGeneratedLines(draft, generated), [draft, generated]);
  // Only the generated sentences still in the draft: one the provider has rewritten or removed no longer
  // needs pointing out.
  const unbacked = useMemo(() => located.filter((line) => line.original.sources.length === 0), [located]);

  // An empty draft has nothing to read (and nothing to click into), and while it is being written the text
  // area stands in for it, so the read view is the paragraph at rest, and only then.
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
    onHoverSources?.(undefined);
    setIsEditing(false);
  };

  return (
    <Box data-testid={testIds.narrativeEditor} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="subtitle2" sx={{ fontSize: scaled(13) }}>
          Narrative
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {showReadView && (
            <Button
              size="small"
              onClick={() => startEditing()}
              disabled={disabled}
              sx={{ textTransform: 'none', minWidth: 0, p: 0, fontSize: scaled(12) }}
              data-testid={testIds.editNarrativeButton}
            >
              Edit
            </Button>
          )}
          <Button
            size="small"
            onClick={onRegenerate}
            disabled={disabled || !hasTranscript}
            sx={{ textTransform: 'none', minWidth: 0, p: 0, fontSize: scaled(12) }}
            data-testid={testIds.regenerateNarrativeButton}
          >
            Regenerate
          </Button>
        </Box>
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
        <NarrativeReadView
          draft={draft}
          located={located}
          disabled={disabled}
          onClick={startEditing}
          onHoverSources={onHoverSources}
        />
      ) : (
        <TextField
          value={draft}
          onChange={(event) => setNarrativeDraft(event.target.value)}
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
        <Box
          data-testid={testIds.narrativeUnbackedNote}
          sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, color: 'warning.main' }}
        >
          <Typography variant="caption">
            ⚠ {unbacked.length} {unbacked.length === 1 ? 'sentence isn’t' : 'sentences aren’t'} an exact match with the
            transcript:
          </Typography>
          {unbacked.map((line, index) => (
            <Box key={index} sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
                “{line.text}”
              </Typography>
              {/* What was actually said, when anything close was; otherwise the sentence stands alone as not found. */}
              <Typography variant="caption" sx={{ color: 'text.secondary', pl: 1.5 }}>
                {line.original.approximateSource
                  ? `transcript: “${line.original.approximateSource}”`
                  : 'not found in the transcript'}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

interface NarrativeReadViewProps {
  draft: string;
  located: LocatedLine[];
  disabled: boolean;
  onClick: (event: MouseEvent<HTMLElement>) => void;
  onHoverSources?: (sources: string[] | undefined) => void;
}

/**
 * The draft at rest, character for character (so a click maps back to an offset in it), cut into the
 * generated sentences still in it and the provider's own words between them. The same look as the results
 * screen's narrative; the runs there open a recommendation, these show the transcript behind a sentence.
 */
const NarrativeReadView: FC<NarrativeReadViewProps> = ({ draft, located, disabled, onClick, onHoverSources }) => {
  // The located lines never overlap (each is searched for after the one before), so every run carries at
  // most one id: its index into `located`.
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
            <NarrativeSentence key={index} index={Number(id)} line={line} onHoverSources={onHoverSources}>
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
  onHoverSources?: (sources: string[] | undefined) => void;
  children: string;
}

/**
 * One generated sentence: the transcript snippets it was written from on hover, or — for one the generator
 * said on its own — a dotted underline at rest, so it can be found without hovering, and the note on hover.
 */
const NarrativeSentence: FC<NarrativeSentenceProps> = ({ index, line, onHoverSources, children }) => {
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
        onMouseEnter={() => onHoverSources?.(sources)}
        onMouseLeave={() => onHoverSources?.(undefined)}
        sx={(theme) => ({
          borderRadius: '4px',
          '&:hover': { backgroundColor: AI_SURFACE },
          ...(isUnbacked
            ? {
                textDecoration: 'underline dotted',
                textDecorationColor: theme.palette.warning.main,
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
 * The offset into the read view's text under a point, so the text area can open with its caret where the
 * click landed. The read view holds the draft character for character, so the offset is the sum of the text
 * nodes before the hit one plus the offset within it. `undefined` (no support, or the click was on the
 * paper rather than on a character) means the end of the text.
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
