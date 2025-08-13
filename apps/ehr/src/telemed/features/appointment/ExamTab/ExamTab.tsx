import { Box } from '@mui/material';
import { FC } from 'react';
import { ExamTable } from 'src/features/css-module/components/examination/ExamTable';
import { ExamDef } from 'utils';
import { useGetAppointmentAccessibility } from '../../../hooks';
import { ReadOnlyCard } from './ReadOnlyCard';

export const ExamTab: FC = () => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      {isReadOnly ? <ReadOnlyCard /> : <ExamTable examConfig={ExamDef().telemed.default.components} />}
    </Box>
  );
};
