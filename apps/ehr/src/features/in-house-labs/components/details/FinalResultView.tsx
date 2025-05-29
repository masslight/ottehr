import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { InHouseOrderDetailPageDTO } from 'utils/lib/types/data/in-house/in-house.types';
import { getFormattedDiagnoses, DiagnosisDTO } from 'utils';
import { FinalResultCard } from './FinalResultCard';

interface FinalResultViewProps {
  testDetails: InHouseOrderDetailPageDTO[] | undefined;
  onBack: () => void;
}

export const FinalResultView: React.FC<FinalResultViewProps> = ({ testDetails, onBack }) => {
  const diagnoses = testDetails?.reduce((acc: DiagnosisDTO[], detail) => {
    detail.diagnosesDTO.forEach((diagnoses) => {
      if (!acc.some((d) => d.code === diagnoses.code)) {
        acc.push(diagnoses);
      }
    });
    return acc;
  }, []);

  if (!testDetails) {
    return (
      <Box>
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="error">
            Test details not found
          </Typography>
        </Paper>
      </Box>
    );
  }
  return (
    <Box>
      <Typography variant="body1" sx={{ mb: 2, fontWeight: 'medium' }}>
        {getFormattedDiagnoses(diagnoses || [])}
      </Typography>

      {testDetails.map((test) => (
        <FinalResultCard testDetails={test} />
      ))}

      <Box display="flex" justifyContent="space-between" alignItems="center" mt={3}>
        <Button variant="outlined" onClick={onBack} sx={{ borderRadius: '50px', px: 4 }}>
          Back
        </Button>
      </Box>
    </Box>
  );
};
