import { alpha, Chip, Stack } from '@mui/material';
import { ReactElement } from 'react';

export interface PlaceholderChipsProps {
  tokens: readonly string[];
  onInsert: (tokenId: string) => void;
}

export function PlaceholderChips({ tokens, onInsert }: PlaceholderChipsProps): ReactElement {
  return (
    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
      {tokens.map((id) => (
        <Chip
          key={id}
          label={`{{${id}}}`}
          size="small"
          variant="outlined"
          onClick={() => onInsert(id)}
          sx={(t) => ({
            cursor: 'pointer',
            color: 'info.main',
            borderColor: 'transparent',
            bgcolor: alpha(t.palette.info.main, 0.1),
          })}
        />
      ))}
    </Stack>
  );
}
