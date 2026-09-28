import { Dialog, DialogContent, DialogTitle, List, ListItemButton, ListItemText, Typography } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';

const testIds = dataTestIds.scribeRecommendations;

/**
 * Asks the provider to choose among near-equal catalogue matches (single-row applies and removals). Skipping
 * settles the step as skipped rather than leaving it hanging.
 */
export const PickerDialog: FC = () => {
  const pendingPick = useScribeRecommendationsStore((state) => state.pendingPick);
  const answerPick = useScribeRecommendationsStore((state) => state.answerPick);

  return (
    <Dialog
      open={Boolean(pendingPick)}
      onClose={() => answerPick(undefined)}
      fullWidth
      data-testid={testIds.pickerDialog}
    >
      <DialogTitle>{pendingPick?.prompt}</DialogTitle>
      <DialogContent>
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
      </DialogContent>
    </Dialog>
  );
};
