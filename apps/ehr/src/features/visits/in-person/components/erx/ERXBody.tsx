import { Stack } from '@mui/material';
import { FC } from 'react';
import { ERxContainer } from '../../../shared/components/plan-tab/ERxContainer';

export const ERXBody: FC = () => {
  return (
    <Stack spacing={1} sx={{ flex: '1 0 auto' }}>
      <ERxContainer />
    </Stack>
  );
};
