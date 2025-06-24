import { Box, CircularProgress, Typography } from '@mui/material';
import React, { FC, useState } from 'react';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useGetAppointmentAccessibility } from '../../../../hooks';
import { useAppointmentStore } from '../../../../state';
import { AssessmentTitle } from './AssessmentTitle';
import { MedicalDecisionField } from './MedicalDecisionField';

export const MedicalDecisionContainer: FC = () => {
  const { chartData, isChartDataLoading: isLoading } = getSelectors(useAppointmentStore, [
    'chartData',
    'isChartDataLoading',
  ]);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const mdm = chartData?.medicalDecision?.text;
  const [isUpdating, setIsUpdating] = useState(false);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <AssessmentTitle>Medical Decision Making</AssessmentTitle>
        {(isUpdating || isLoading) && <CircularProgress size={16} />}
      </Box>
      {isReadOnly ? (
        mdm ? (
          <Typography>{mdm}</Typography>
        ) : (
          <Typography color="secondary.light">Not provided</Typography>
        )
      ) : (
        <MedicalDecisionField loading={isLoading} setIsUpdating={setIsUpdating} />
      )}
    </Box>
  );
};
