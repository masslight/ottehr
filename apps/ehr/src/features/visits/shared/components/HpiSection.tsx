import { otherColors } from '@ehrTheme/colors';
import { Paper, Stack, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { AiHpiSuggestion } from '../../AiHpiSuggestion';
import { ChiefComplaintFieldReadOnly } from '../../ChiefComplaintField';
import { HistoryOfPresentIllnessField, HistoryOfPresentIllnessFieldReadOnly } from '../../HpiField';
import { ReasonForVisitFieldReadOnly } from '../../ReasonForVisitField';
import { RosField, RosFieldReadOnly } from '../../RosField';
import { useGetAppointmentAccessibility } from '../hooks/useGetAppointmentAccessibility';

export const HPISection: FC = () => {
  const theme = useTheme();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
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

            <ReasonForVisitFieldReadOnly valueSource="patient" />

            <ReasonForVisitFieldReadOnly valueSource="intake" />

            <ChiefComplaintFieldReadOnly label="Chief Complaint on intake" />

            <AiHpiSuggestion />
          </Stack>
        }
        rightColumn={
          <Stack spacing={1.5}>
            <Typography
              sx={{
                color: otherColors.orange700,
                fontWeight: 'medium',
                textTransform: 'uppercase',
              }}
            >
              Provider
            </Typography>

            {isReadOnly ? <HistoryOfPresentIllnessFieldReadOnly /> : <HistoryOfPresentIllnessField />}

            {isReadOnly ? <RosFieldReadOnly /> : <RosField />}
          </Stack>
        }
      />
    </Paper>
  );
};
