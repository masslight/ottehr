import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
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
  /** Secondary line (e.g. a medication's strength). */
  secondary?: string;
}

interface AiChartedItemProps {
  /** The rendered item label (the same content a normal note row would show). */
  children: React.ReactNode;
  /** Auto-picked but ambiguous → flagged for extra attention. */
  lowConfidence?: boolean;
  /** Seed query for the alternatives search (usually the item's display text). */
  initialQuery: string;
  onSearch: (query: string) => Promise<AiAlternative[]>;
  /** Replace the item with the chosen alternative; the checkboxOption state (if any) carries over. */
  onReplace: (key: string, checkboxChecked?: boolean) => void | Promise<void>;
  onRemove: () => void | Promise<void>;
  onDiscuss: () => void;
  /** Hide the "Discuss" action (code-based items have no right-panel picker). */
  hideDiscuss?: boolean;
  // An optional checkbox shown at the top of the popover (e.g. medications' "Patient doesn't know
  // dosage", or ROS "Patient denies"). Toggling it updates the CURRENT item in place via onChange;
  // its state is also passed to onReplace so a chosen replacement inherits it.
  checkboxOption?: { label: string; checked: boolean; onChange: (checked: boolean) => void };
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
  hideDiscuss,
  checkboxOption,
}: AiChartedItemProps): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<AiAlternative[]>([]);
  const [loading, setLoading] = useState(false);
  const [optChecked, setOptChecked] = useState(!!checkboxOption?.checked);
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
    setOptChecked(!!checkboxOption?.checked);
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
          {checkboxOption && (
            <FormControlLabel
              sx={{ mb: 0.5 }}
              control={
                <Checkbox
                  size="small"
                  checked={optChecked}
                  onChange={(e) => {
                    setOptChecked(e.target.checked);
                    // Toggle applies to the CURRENT item in place; it also carries to a replacement.
                    checkboxOption.onChange(e.target.checked);
                  }}
                />
              }
              label={<Typography variant="caption">{checkboxOption.label}</Typography>}
            />
          )}
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
                      void onReplace(r.key, optChecked);
                    }}
                  >
                    <ListItemText
                      primaryTypographyProps={{ variant: 'body2' }}
                      primary={r.label}
                      secondary={r.secondary || undefined}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Box>
          <Divider sx={{ my: 1 }} />
          <Stack direction="row" spacing={1}>
            {!hideDiscuss && (
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
            )}
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
