import { otherColors } from '@ehrTheme/colors';
import { ottehrAiIcon } from '@ehrTheme/icons';
import CloseIcon from '@mui/icons-material/Close';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import { FC, useState } from 'react';
import React from 'react';
import { CPTCodeDTO, DiagnosisDTO } from 'utils';
import { useRecommendBillingSuggestions } from '../stores/appointment/appointment.queries';
import { useChartData } from '../stores/appointment/appointment.store';

export const AiPotentialDiagnosesCard: FC = () => {
  const theme = useTheme();
  const { chartData } = useChartData();
  const [visible, setVisible] = useState<boolean>(true);
  const aiPotentialDiagnoses = chartData?.aiPotentialDiagnosis ?? [];
  const { mutateAsync: recommendBillingSuggestions } = useRecommendBillingSuggestions();
  const [billingSuggestions, setBillingSuggestions] = useState<string | undefined>(undefined);

  React.useEffect(() => {
    console.log(JSON.stringify(chartData?.diagnosis));
    const fetchRecommendedBillingSuggestions = async (): Promise<void> => {
      const diagnoses: DiagnosisDTO[] | undefined = chartData?.diagnosis;
      const cptCodes: CPTCodeDTO[] | undefined = [];

      if (chartData?.cptCodes) {
        cptCodes.push(...chartData.cptCodes);
      }
      if (chartData?.emCode) {
        cptCodes.push(chartData.emCode);
      }

      if (!diagnoses || !cptCodes) {
        setBillingSuggestions(undefined);
        return;
      }
      if (diagnoses.length === 0 && cptCodes.length === 0) {
        setBillingSuggestions(undefined);
        return;
      }
      const billingSuggestionTemp = await recommendBillingSuggestions({
        diagnoses: diagnoses.length > 0 ? diagnoses : undefined,
        billing: cptCodes.length > 0 ? cptCodes : undefined,
      });
      setBillingSuggestions(billingSuggestionTemp);
    };
    fetchRecommendedBillingSuggestions().catch((error) => console.log(error));
  }, [chartData?.diagnosis, chartData?.cptCodes, chartData?.emCode, recommendBillingSuggestions]);

  const handleClose = (): void => {
    setVisible(false);
  };
  return visible && (aiPotentialDiagnoses.length > 0 || billingSuggestions) ? (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1px',
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${otherColors.solidLine}`,
        borderRadius: 1,
        marginBottom: '16px',
        padding: '16px',
      }}
    >
      <Box
        style={{
          display: 'flex',
          borderRadius: '8px',
          marginBottom: '8px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <img src={ottehrAiIcon} style={{ width: '30px', marginRight: '8px' }} />
          <Typography variant="subtitle2" style={{ fontWeight: 700, fontSize: '14px' }}>
            OYSTEHR AI
          </Typography>
        </Box>
        <IconButton onClick={handleClose} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </Box>
      {aiPotentialDiagnoses.length > 0 && (
        <Box
          style={{
            background: '#E1F5FECC',
            borderRadius: '8px',
            padding: '8px',
            marginBottom: '10px',
          }}
        >
          <Typography variant="body1" style={{ fontWeight: 700, marginBottom: '8px' }}>
            Potential Diagnoses with ICD-10 Codes
          </Typography>
          <ul>
            {aiPotentialDiagnoses.map((diagnosis) => {
              return (
                <li key={diagnosis.code}>
                  <Typography variant="body1">{diagnosis.code + ': ' + diagnosis.display}</Typography>
                </li>
              );
            })}
          </ul>
        </Box>
      )}
      {billingSuggestions && (
        <Box
          style={{
            background: '#E1F5FECC',
            borderRadius: '8px',
            padding: '8px',
          }}
        >
          <Typography variant="body1" style={{ fontWeight: 700, marginBottom: '8px' }}>
            Coding Suggestions
          </Typography>
          <Typography variant="body1">{billingSuggestions}</Typography>
        </Box>
      )}
    </Box>
  ) : (
    <></>
  );
};
