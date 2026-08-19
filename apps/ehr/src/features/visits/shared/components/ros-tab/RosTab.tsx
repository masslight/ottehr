import { Stack } from '@mui/material';
import { FC } from 'react';
import { PageTitle } from '../PageTitle';
import { RosBody } from './RosBody';

export const RosTab: FC = () => {
  return (
    <Stack direction="column" gap={1}>
      <PageTitle label="Review of Systems" showIntakeNotesButton={false} />
      <RosBody />
    </Stack>
  );
};
