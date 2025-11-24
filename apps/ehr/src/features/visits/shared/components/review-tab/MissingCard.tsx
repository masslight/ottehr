import { Box, Link, Typography } from '@mui/material';
import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccordionCard } from 'src/components/AccordionCard';
import { LoadingScreen } from 'src/components/LoadingScreen';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getAssessmentUrl, getHpiUrl } from 'src/features/visits/in-person/routing/helpers';
import { TelemedAppointmentVisitTabs } from 'utils';
import { useChartFields } from '../../hooks/useChartFields';
import { useAppointmentData, useAppTelemedLocalStore, useChartData } from '../../stores/appointment/appointment.store';
import { useAppFlags } from '../../stores/contexts/useAppFlags';

export const MissingCard: FC = () => {
  const { appointment } = useAppointmentData();
  const { chartData } = useChartData();

  const { data: chartFields, isFetching } = useChartFields({
    requestedFields: {
      medicalDecision: {
        _tag: 'medical-decision',
      },
      chiefComplaint: {
        _tag: 'chief-complaint',
      },
    },
  });

  const { isInPerson } = useAppFlags();
  const navigate = useNavigate();
  const primaryDiagnosis = (chartData?.diagnosis || []).find((item) => item.isPrimary);
  const medicalDecision = chartFields?.medicalDecision?.text;
  const emCode = chartData?.emCode;
  const hpi = chartFields?.chiefComplaint?.text;

  if (primaryDiagnosis && medicalDecision && emCode && hpi) {
    return null;
  }

  const navigateTo = (target: 'hpi' | 'assessment'): void => {
    if (isInPerson) {
      const inPersonRoutes: Record<'hpi' | 'assessment', string> = {
        hpi: getHpiUrl(appointment?.id || ''),
        assessment: getAssessmentUrl(appointment?.id || ''),
      };

      requestAnimationFrame(() => {
        navigate(inPersonRoutes[target]);
      });
    } else {
      const telemedTabs: Record<'hpi' | 'assessment', TelemedAppointmentVisitTabs> = {
        hpi: TelemedAppointmentVisitTabs.hpi,
        assessment: TelemedAppointmentVisitTabs.assessment,
      };

      useAppTelemedLocalStore.setState({
        currentTab: telemedTabs[target],
      });
    }
  };

  return (
    <AccordionCard label="Missing" dataTestId={dataTestIds.progressNotePage.missingCard}>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'start', position: 'relative' }}>
        {isFetching && <LoadingScreen />}
        <Typography data-testid={dataTestIds.progressNotePage.missingCardText}>
          This information is required to sign the chart. Click on the item to navigate to it.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {!hpi && (
            <Link
              sx={{ cursor: 'pointer' }}
              color="error"
              onClick={() => navigateTo('hpi')}
              data-testid={dataTestIds.progressNotePage.hpiLink}
            >
              HPI
            </Link>
          )}
          {!primaryDiagnosis && (
            <Link
              sx={{ cursor: 'pointer' }}
              color="error"
              onClick={() => navigateTo('assessment')}
              data-testid={dataTestIds.progressNotePage.primaryDiagnosisLink}
            >
              Primary diagnosis
            </Link>
          )}
          {!medicalDecision && (
            <Link
              sx={{ cursor: 'pointer' }}
              color="error"
              onClick={() => navigateTo('assessment')}
              data-testid={dataTestIds.progressNotePage.medicalDecisionLink}
            >
              Medical decision making
            </Link>
          )}
          {!emCode && (
            <Link
              sx={{ cursor: 'pointer' }}
              color="error"
              onClick={() => navigateTo('assessment')}
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
