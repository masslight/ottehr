import { Box, Link, Typography } from '@mui/material';
import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccordionCard } from 'src/components/AccordionCard';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getAssessmentUrl } from 'src/features/visits/in-person/routing/helpers';
import { TelemedAppointmentVisitTabs } from 'utils';
import { useChartFields } from '../../hooks/useChartFields';
import { useAppointmentData, useAppTelemedLocalStore, useChartData } from '../../stores/appointment/appointment.store';
import { useAppFlags } from '../../stores/contexts/useAppFlags';

export const MissingCard: FC = () => {
  const { appointment } = useAppointmentData();
  const { chartData } = useChartData();

  const { data: chartFields } = useChartFields({
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

  const navigateToTab = (): void => {
    if (isInPerson) {
      requestAnimationFrame(() => {
        navigate(getAssessmentUrl(appointment?.id || ''));
      });
    } else {
      useAppTelemedLocalStore.setState({ currentTab: TelemedAppointmentVisitTabs.assessment });
    }
  };

  const scrollOrNavigateToHPI = (): void => {
    if (isInPerson) {
      const headings = Array.from(document.querySelectorAll('h6'));
      const hpiHeading = headings.find((heading) => heading.textContent === 'Chief Complaint & HPI');
      if (hpiHeading) {
        hpiHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      useAppTelemedLocalStore.setState({ currentTab: TelemedAppointmentVisitTabs.hpi });
    }
  };

  return (
    <AccordionCard label="Missing" dataTestId={dataTestIds.progressNotePage.missingCard}>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'start' }}>
        <Typography data-testid={dataTestIds.progressNotePage.missingCardText}>
          This information is required to sign the chart. Click on the item to navigate to it.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {!hpi && (
            <Link
              sx={{ cursor: 'pointer' }}
              color="error"
              onClick={scrollOrNavigateToHPI}
              data-testid={dataTestIds.progressNotePage.emCodeLink}
            >
              HPI
            </Link>
          )}
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
