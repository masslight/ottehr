import { Box, Link, Typography } from '@mui/material';
import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { TelemedAppointmentVisitTabs } from 'utils';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { useFeatureFlags } from '../../../../features/css-module/context/featureFlags';
import { getAssessmentUrl } from '../../../../features/css-module/routing/helpers';
import { AccordionCard } from '../../../components';
import { useAppointmentData, useAppTelemedLocalStore, useChartData } from '../../../state';

export const MissingCard: FC = () => {
  const { appointment } = useAppointmentData();
  const { chartData } = useChartData();
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
      useAppTelemedLocalStore.setState({ currentTab: TelemedAppointmentVisitTabs.assessment });
    }
  };

  return (
    <AccordionCard label="Missing" dataTestId={dataTestIds.progressNotePage.missingCard}>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'start' }}>
        <Typography data-testid={dataTestIds.progressNotePage.missingCardText}>
          This information is required to sign the chart. Please go to Assessment tab and complete it.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {!primaryDiagnosis && (
            <Link
              sx={{ cursor: 'pointer' }}
              color="error"
              onClick={navigateToTab}
              data-testid={dataTestIds.progressNotePage.primaryDiagnosisLink}
            >
              Primary diagnosis
            </Link>
          )}
          {!medicalDecision && (
            <Link
              sx={{ cursor: 'pointer' }}
              color="error"
              onClick={navigateToTab}
              data-testid={dataTestIds.progressNotePage.medicalDecisionLink}
            >
              Medical decision making
            </Link>
          )}
          {!emCode && (
            <Link
              sx={{ cursor: 'pointer' }}
              color="error"
              onClick={navigateToTab}
              data-testid={dataTestIds.progressNotePage.emCodeLink}
            >
              E&M code
            </Link>
          )}
        </Box>
      </Box>
    </AccordionCard>
  );
};
