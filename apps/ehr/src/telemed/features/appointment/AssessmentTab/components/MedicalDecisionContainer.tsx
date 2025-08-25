import { Box, CircularProgress, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useGetAppointmentAccessibility } from '../../../../hooks';
import { useChartData } from '../../../../state';
import { AssessmentTitle } from './AssessmentTitle';
import { MedicalDecisionField } from './MedicalDecisionField';

export const MedicalDecisionContainer: FC = () => {
  const { chartData, isChartDataLoading } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const mdm = chartData?.medicalDecision?.text;
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
