import { otherColors } from '@ehrTheme/colors';
import { ottehrAiIcon } from '@ehrTheme/icons';
import CloseIcon from '@mui/icons-material/Close';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import React, { FC, useState } from 'react';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';

export const AiPotentialDiagnosesCard: FC = () => {
  const theme = useTheme();
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);
  const [visible, setVisible] = useState<boolean>(true);
  const aiPotentialDiagnoses = chartData?.aiPotentialDiagnosis ?? [];

  const handleClose = (): void => {
    setVisible(false);
  };
  return visible && aiPotentialDiagnoses.length > 0 ? (
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
      <Box
        style={{
          background: '#FFF9EF',
          borderRadius: '8px',
          padding: '8px',
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
    </Box>
  ) : (
    <></>
  );
};
