import React, { FC } from 'react';
import { Box, Typography, Link } from '@mui/material';
import { AccordionCard } from '../../../components';
import { useAppointmentStore } from '../../../state';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useFeatureFlags } from '../../../../features/css-module/context/featureFlags';
import { useNavigate } from 'react-router-dom';
import { getAssessmentUrl } from '../../../../features/css-module/routing/helpers';

export const MissingCard: FC = () => {
  const { chartData, appointment } = getSelectors(useAppointmentStore, ['chartData', 'appointment']);
  const { css } = useFeatureFlags();
  const navigate = useNavigate();

  const primaryDiagnosis = (chartData?.diagnosis || []).find((item) => item.isPrimary);
  const medicalDecision = chartData?.medicalDecision?.text;
  const emCode = chartData?.emCode;

  if (primaryDiagnosis && medicalDecision && emCode) {
    return null;
  }

  const navigateToTab = (): void => {
    if (css) {
      requestAnimationFrame(() => {
        navigate(getAssessmentUrl(appointment?.id || ''));
      });
    } else {
      useAppointmentStore.setState({ currentTab: 'erx' });
    }
  };

  return (
    <AccordionCard label="Missing">
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'start' }}>
        <Typography>
          This information is required to sign the chart. Please go to Assessment tab and complete it.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {!primaryDiagnosis && (
            <Link sx={{ cursor: 'pointer' }} color="error" onClick={navigateToTab}>
              Primary diagnosis
            </Link>
          )}
          {!medicalDecision && (
            <Link sx={{ cursor: 'pointer' }} color="error" onClick={navigateToTab}>
              Medical decision making
            </Link>
          )}
          {!emCode && (
            <Link sx={{ cursor: 'pointer' }} color="error" onClick={navigateToTab}>
              E&M code
            </Link>
          )}
        </Box>
      </Box>
    </AccordionCard>
  );
};
