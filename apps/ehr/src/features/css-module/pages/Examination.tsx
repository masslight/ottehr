import { Box } from '@mui/material';
import { FC } from 'react';
import { ExamDef } from 'utils';
import { useGetAppointmentAccessibility } from '../../../telemed';
import { ExamReadOnly } from '../components/examination/ExamReadOnly';
import { ExamTable } from '../components/examination/ExamTable';

export const Examination: FC = () => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      {isReadOnly ? <ExamReadOnly /> : <ExamTable examConfig={ExamDef().inPerson.default.components} />}
    </Box>
  );
};
