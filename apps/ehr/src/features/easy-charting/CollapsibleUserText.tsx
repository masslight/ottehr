import { Box, Typography } from '@mui/material';

/** Character cutoff, not words, so a pasted dictation collapses even as one long paragraph. */
export const USER_TEXT_COLLAPSE_THRESHOLD = 350;

/** Word count shown in the collapsed toggle label. */
export const countWords = (text: string): number => text.trim().split(/\s+/).length;

interface CollapsibleUserTextProps {
  text: string;
  /** Expansion lives with the caller (keyed by message id) so re-renders can't snap a bubble shut. */
  expanded: boolean;
  onToggle: () => void;
}

/**
 * User-bubble text that collapses long messages (pasted dictations, sent transcripts) to ~4 lines
 * with a fade into the bubble background. Messages at or under the threshold render exactly as a
 * plain pre-wrap Typography. The fade assumes the user-bubble background (`primary.main`).
 */
export function CollapsibleUserText({ text, expanded, onToggle }: CollapsibleUserTextProps): JSX.Element {
  if (text.length <= USER_TEXT_COLLAPSE_THRESHOLD) {
    return (
      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
        {text}
      </Typography>
    );
  }
  return (
    <>
      <Box sx={{ position: 'relative' }}>
        <Typography
          variant="body1"
          // 6em ≈ 4 lines at body1's 1.5 line-height.
          sx={{ whiteSpace: 'pre-wrap', ...(expanded ? {} : { maxHeight: '6em', overflow: 'hidden' }) }}
        >
          {text}
        </Typography>
        {!expanded && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '1.8em',
              background: (theme) => `linear-gradient(transparent, ${theme.palette.primary.main})`,
              pointerEvents: 'none',
            }}
          />
        )}
      </Box>
      <Box
        component="button"
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        sx={{
          display: 'block',
          mt: 0.5,
          p: 0,
          border: 'none',
          background: 'none',
          color: 'inherit',
          fontFamily: 'inherit',
          fontSize: '0.84rem',
          fontWeight: 600,
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
      >
        {expanded ? 'Show less' : `Show more · ${countWords(text)} words`}
      </Box>
    </>
  );
}
