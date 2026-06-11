import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useState } from 'react';

/** One alternative offered in the correction popover. `key` round-trips back to the caller. */
export interface AiAlternative {
  key: string;
  label: string;
}

interface AiChartedItemProps {
  /** The rendered item label (the same content a normal note row would show). */
  children: React.ReactNode;
  /** Auto-picked but ambiguous → flagged for extra attention. */
  lowConfidence?: boolean;
  /** Seed query for the alternatives search (usually the item's display text). */
  initialQuery: string;
  onSearch: (query: string) => Promise<AiAlternative[]>;
  onReplace: (key: string) => void | Promise<void>;
  onRemove: () => void | Promise<void>;
  onDiscuss: () => void;
}

/**
 * An AI-charted note item: highlighted to show it was placed by the assistant and still needs the
 * provider's review. Clicking it opens a popover to swap it for an alternative (searched), remove
 * it, or kick it back to the right-hand AI panel ("Discuss") for more detailed options. Reuses the
 * search/replace/remove plumbing the Easy Chart page already has, via callbacks.
 */
export function AiChartedItem({
  children,
  lowConfidence,
  initialQuery,
  onSearch,
  onReplace,
  onRemove,
  onDiscuss,
}: AiChartedItemProps): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<AiAlternative[]>([]);
  const [loading, setLoading] = useState(false);
  const open = Boolean(anchor);

  const doSearch = useCallback(
    async (q: string): Promise<void> => {
      setLoading(true);
      try {
        setResults(await onSearch(q));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [onSearch]
  );

  const handleOpen = (e: React.MouseEvent<HTMLElement>): void => {
    setAnchor(e.currentTarget);
    setQuery(initialQuery);
    void doSearch(initialQuery);
  };
  const close = (): void => setAnchor(null);

  // Blue = AI-charted/needs review; amber = low-confidence (ambiguous auto-pick).
  const tint = lowConfidence ? 'rgba(237,108,2,0.14)' : 'rgba(25,118,210,0.12)';
  const tintHover = lowConfidence ? 'rgba(237,108,2,0.26)' : 'rgba(25,118,210,0.24)';

  return (
    <>
      <Box
        onClick={handleOpen}
        role="button"
        aria-label="Review AI-charted item"
        sx={{
          cursor: 'pointer',
          borderRadius: 1,
          px: 0.5,
          mx: -0.5,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 0.5,
          bgcolor: tint,
          transition: 'background-color .15s',
          '&:hover': { bgcolor: tintHover },
        }}
      >
        {lowConfidence && (
          <WarningAmberIcon
            sx={{ fontSize: 15, color: 'warning.main', mt: '2px' }}
            titleAccess="Low confidence — review"
          />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
      </Box>
      <Popover
        open={open}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { width: 340, maxWidth: '90vw' } } }}
      >
        <Box sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Replace or correct
          </Typography>
          <TextField
            size="small"
            fullWidth
            autoFocus
            placeholder="Search alternatives…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void doSearch(query);
              }
            }}
          />
          <Box sx={{ mt: 1, maxHeight: 240, overflow: 'auto' }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={20} />
              </Box>
            ) : results.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                No matches
              </Typography>
            ) : (
              <List dense disablePadding>
                {results.map((r) => (
                  <ListItemButton
                    key={r.key}
                    onClick={() => {
                      close();
                      void onReplace(r.key);
                    }}
                  >
                    <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={r.label} />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Box>
          <Divider sx={{ my: 1 }} />
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />}
              onClick={() => {
                close();
                onDiscuss();
              }}
            >
              Discuss
            </Button>
            <Button
              size="small"
              color="error"
              startIcon={<CloseIcon sx={{ fontSize: 16 }} />}
              onClick={() => {
                close();
                void onRemove();
              }}
            >
              Remove
            </Button>
          </Stack>
        </Box>
      </Popover>
    </>
  );
}
