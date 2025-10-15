import { Box, CircularProgress, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useChartFields } from '../../hooks/useChartFields';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { MedicalDecisionField } from './MedicalDecisionField';

export const MedicalDecisionContainer: FC = () => {
  const { data: chartFields, isLoading: isChartDataLoading } = useChartFields({
    requestedFields: {
      medicalDecision: {
        _tag: 'medical-decision',
      },
    },
  });

  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const mdm = chartFields?.medicalDecision?.text;
  const [isUpdating, setIsUpdating] = useState(false);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <AssessmentTitle>Medical Decision Making</AssessmentTitle>
        {(isUpdating || isChartDataLoading) && (
          <CircularProgress data-testid={dataTestIds.assessmentCard.medicalDecisionLoading} size={16} />
        )}
      </Box>
      {isReadOnly ? (
        mdm ? (
          <Typography>{mdm}</Typography>
        ) : (
          <Typography color="secondary.light">Not provided</Typography>
        )
      ) : (
        <MedicalDecisionField loading={isChartDataLoading} setIsUpdating={setIsUpdating} />
      )}
    </Box>
  );
};
