import React, { FC } from 'react';
import { Box, Typography } from '@mui/material';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';
import { AssessmentTitle } from '../../AssessmentTab';

export const AssessmentContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

  const diagnoses = chartData?.diagnosis || [];
  const primaryDiagnosis = diagnoses.find((item) => item.isPrimary);
  const otherDiagnoses = diagnoses.filter((item) => !item.isPrimary);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Assessment
      </Typography>
      {diagnoses && diagnoses.length > 0 ? (
        <>
          {primaryDiagnosis && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <AssessmentTitle>Primary:</AssessmentTitle>
              <Typography>{primaryDiagnosis.display}</Typography>
            </Box>
          )}
          {otherDiagnoses && otherDiagnoses.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <AssessmentTitle>Secondary:</AssessmentTitle>
              {otherDiagnoses.map((diagnosis) => (
                <Typography key={diagnosis.resourceId}>{diagnosis.display}</Typography>
              ))}
            </Box>
          )}
        </>
      ) : (
        <Typography color="secondary.light">No diagnoses provided</Typography>
      )}
    </Box>
  );
};
