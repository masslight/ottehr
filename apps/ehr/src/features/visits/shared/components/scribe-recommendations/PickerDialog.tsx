import { List, ListItemButton, ListItemText, Typography } from '@mui/material';
import { FC } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';

const testIds = dataTestIds.scribeRecommendations;

const SMALL_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'by',
  'to',
  'of',
  'for',
  'in',
  'on',
  'at',
  'as',
  'with',
  'from',
]);

// The prompt arrives as a sentence built around a lower-case catalogue noun ("Which in-house lab did you
// mean?"); as a dialog title it is shown in Title Case.
const toTitleCase = (text: string): string => {
  const words = text.split(' ');
  return words
    .map((word, index) =>
      index > 0 && index < words.length - 1 && SMALL_WORDS.has(word.toLowerCase())
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');
};

/**
 * Asks the provider to choose among near-equal catalogue matches when one row is applied on its own. Skipping
 * settles the step as skipped rather than leaving it hanging.
 */
export const PickerDialog: FC = () => {
  const pendingPick = useScribeRecommendationsStore((state) => state.pendingPick);
  const answerPick = useScribeRecommendationsStore((state) => state.answerPick);

  return (
    <AppDialog
      variant="form"
      size="m"
      open={Boolean(pendingPick)}
      onClose={() => answerPick(undefined)}
      title={toTitleCase(pendingPick?.prompt ?? '')}
      data-testid={testIds.pickerDialog}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        The transcript said “{pendingPick?.query}”.
      </Typography>
      <List dense>
        {pendingPick?.options.map((option) => (
          <ListItemButton
            key={option.id}
            onClick={() => answerPick(option)}
            data-testid={testIds.pickerOption(option.id)}
          >
            <ListItemText primary={option.display} />
          </ListItemButton>
        ))}
        <ListItemButton onClick={() => answerPick(undefined)} data-testid={testIds.pickerSkip}>
          <ListItemText primary="Skip — none of these" primaryTypographyProps={{ color: 'text.secondary' }} />
        </ListItemButton>
      </List>
    </AppDialog>
  );
};
