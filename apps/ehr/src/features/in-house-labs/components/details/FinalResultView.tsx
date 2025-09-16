import { BiotechOutlined } from '@mui/icons-material';
import { Box, Button, Paper, Typography } from '@mui/material';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { DiagnosisDTO, getFormattedDiagnoses } from 'utils';
import { InHouseOrderDetailPageItemDTO } from 'utils/lib/types/data/in-house/in-house.types';
import { FinalResultCard } from './FinalResultCard';

interface FinalResultViewProps {
  testDetails: InHouseOrderDetailPageItemDTO[] | undefined;
  onBack: () => void;
}

export const FinalResultView: React.FC<FinalResultViewProps> = ({ testDetails, onBack }) => {
  const navigate = useNavigate();

  // we sort the tests on the back end, most recent will always be first
  // const sortedOrders = inHouseOrders.sort((a, b) => compareDates(a.orderAddedDate, b.orderAddedDate));
  const mostRecentTest = testDetails?.[0];
  const openPdf = (): void => {
    if (mostRecentTest?.resultsPDFUrl) {
      window.open(mostRecentTest.resultsPDFUrl, '_blank');
    }
  };

  const diagnoses = testDetails?.reduce((acc: DiagnosisDTO[], detail) => {
    detail.diagnosesDTO.forEach((diagnoses) => {
      if (!acc.some((d) => d.code === diagnoses.code)) {
        acc.push(diagnoses);
      }
    });
    return acc;
  }, []);

  const isRepeatable = testDetails?.some((detail) => detail.labDetails.repeatable);
  const handleRepeatOnClick = (): void => {
    navigate(`/in-person/${testDetails?.[0].appointmentId}/in-house-lab-orders/create`, {
      state: {
        testItemName: testDetails?.[0]?.testItemName,
        diagnoses: diagnoses,
      },
    });
  };

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
      <Typography
        data-testid={dataTestIds.finalResultPage.diagnose}
        variant="body1"
        sx={{ mb: 2, fontWeight: 'medium' }}
      >
        {getFormattedDiagnoses(diagnoses || [])}
      </Typography>

      {openPdf && (
        <Button
          data-testid={dataTestIds.finalResultPage.resultsPDF}
          variant="outlined"
          color="primary"
          sx={{ borderRadius: '50px', textTransform: 'none', mb: '12px' }}
          onClick={() => openPdf()}
          startIcon={<BiotechOutlined />}
          disabled={!mostRecentTest?.resultsPDFUrl}
        >
          Results PDF
        </Button>
      )}

      {testDetails.map((test, idx) => (
        <FinalResultCard key={`${idx}-${test.testItemName.split(' ').join('')}`} testDetails={test} />
      ))}

      <Box display="flex" justifyContent="space-between" alignItems="center" mt={3}>
        <Button variant="outlined" onClick={onBack} sx={{ borderRadius: '50px', px: 4 }}>
          Back
        </Button>
        {isRepeatable && (
          <Button variant="outlined" onClick={handleRepeatOnClick} sx={{ borderRadius: '50px', px: 4 }}>
            Repeat
          </Button>
        )}
      </Box>
    </Box>
  );
};
