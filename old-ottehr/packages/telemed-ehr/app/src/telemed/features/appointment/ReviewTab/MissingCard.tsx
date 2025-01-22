import React, { FC } from 'react';
import { Box, Typography, Link } from '@mui/material';
import { AccordionCard } from '../../../components';
import { useAppointmentStore } from '../../../state';
import { getSelectors } from '../../../../shared/store/getSelectors';

export const MissingCard: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

  const primaryDiagnosis = (chartData?.diagnosis || []).find((item) => item.isPrimary);
  const medicalDecision = chartData?.medicalDecision?.text;
  const cptCode = (chartData?.cptCodes || [])[0];

  if (primaryDiagnosis && medicalDecision && cptCode) {
    return null;
  }

  return (
    <AccordionCard label="Missing">
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'start' }}>
        <Typography>
          This information is required to sign the chart. Please go to Assessment & MDM tab and complete it.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {!primaryDiagnosis && (
            <Link
              sx={{ cursor: 'pointer' }}
              color="error"
              onClick={() => useAppointmentStore.setState({ currentTab: 'erx' })}
            >
              Primary diagnosis
            </Link>
          )}
          {!medicalDecision && (
            <Link
              sx={{ cursor: 'pointer' }}
              color="error"
              onClick={() => useAppointmentStore.setState({ currentTab: 'erx' })}
            >
              Medical decision making
            </Link>
          )}
          {!cptCode && (
            <Link
              sx={{ cursor: 'pointer' }}
              color="error"
              onClick={() => useAppointmentStore.setState({ currentTab: 'erx' })}
            >
              CPT code
            </Link>
          )}
        </Box>
      </Box>
    </AccordionCard>
  );
};
