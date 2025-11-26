import { otherColors } from '@ehrTheme/colors';
import { Paper, Stack, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { AiHpiSuggestion } from '../../AiHpiSuggestion';
import { ChiefComplaintField, ChiefComplaintFieldReadOnly } from '../../ChiefComplaintField';
import { ReasonForVisitField, ReasonForVisitFieldReadOnly } from '../../ReasonForVisitField';
import { useGetAppointmentAccessibility } from '../hooks/useGetAppointmentAccessibility';

export const ChiefComplaintSection: FC = () => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const theme = useTheme();

  return (
    <Paper elevation={3} sx={{ boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1)' }}>
      <DoubleColumnContainer
        divider
        padding
        leftColumn={
          <Stack spacing={1}>
            <Typography
              sx={{
                color: theme.palette.primary.dark,
                fontWeight: 'medium',
                textTransform: 'uppercase',
              }}
            >
              Patient Provided
            </Typography>

            <ReasonForVisitFieldReadOnly />

            <AiHpiSuggestion />
          </Stack>
        }
        rightColumn={
          <Stack spacing={1}>
            <Typography
              sx={{
                color: otherColors.orange700,
                fontWeight: 'medium',
                textTransform: 'uppercase',
              }}
            >
              Confirmed by staff during visit
            </Typography>

            {isReadOnly ? <ReasonForVisitFieldReadOnly valueSource="intake" /> : <ReasonForVisitField />}

            {isReadOnly ? <ChiefComplaintFieldReadOnly /> : <ChiefComplaintField />}
          </Stack>
        }
      />
    </Paper>
  );
};
