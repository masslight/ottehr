import { otherColors } from '@ehrTheme/colors';
import { WarningAmber } from '@mui/icons-material';
import { Avatar, Box, Link, Typography } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccordionCard } from 'src/components/AccordionCard';
import { LoadingScreen } from 'src/components/LoadingScreen';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getAssessmentUrl, getChiefComplaintUrl, getHPIUrl } from 'src/features/visits/in-person/routing/helpers';
import { TelemedAppointmentVisitTabs } from 'utils';
import { useChartFields } from '../../hooks/useChartFields';
import { useAiSuggestionNotes } from '../../stores/appointment/appointment.queries';
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
      historyOfPresentIllness: {
        _tag: 'history-of-present-illness',
      },
    },
  });

  const { mutateAsync: aiSuggestionNotes } = useAiSuggestionNotes();

  const { isInPerson } = useAppFlags();
  const navigate = useNavigate();
  const primaryDiagnosis = (chartData?.diagnosis || []).find((item) => item.isPrimary);
  const medicalDecision = chartFields?.medicalDecision?.text;
  const emCode = chartData?.emCode;
  const hpi = chartFields?.chiefComplaint?.text;
  const chiefComplaint = chartFields?.historyOfPresentIllness?.text;
  const [suggestionNote, setSuggestionNote] = useState<string | undefined>(undefined);

  useEffect(() => {
    const loadSuggestions = async (): Promise<void> => {
      if (!hpi) return;

      const suggestionNoteTemp = await aiSuggestionNotes({
        type: 'missing-hpi',
        hpi,
      });
      setSuggestionNote(suggestionNoteTemp.suggestions?.[0]);
    };

    loadSuggestions().catch((error) => console.log('Error fetching suggestion note', error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hpi]);

  if (primaryDiagnosis && medicalDecision && emCode && hpi && (!isInPerson || chiefComplaint) && !suggestionNote) {
    return null;
  }

  const navigateTo = (target: 'chief-complaint' | 'hpi' | 'assessment'): void => {
    if (isInPerson) {
      const inPersonRoutes: Record<'chief-complaint' | 'hpi' | 'assessment', string> = {
        'chief-complaint': getChiefComplaintUrl(appointment?.id || ''),
        hpi: getHPIUrl(appointment?.id || ''),
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

      if (target === 'chief-complaint') return;

      useAppTelemedLocalStore.setState({
        currentTab: telemedTabs[target],
      });
    }
  };

  return (
    <AccordionCard label="Missing & Warnings" dataTestId={dataTestIds.progressNotePage.missingCard}>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'start', position: 'relative' }}>
        {isFetching && <LoadingScreen />}
        <Typography data-testid={dataTestIds.progressNotePage.missingCardText}>
          Click on the item to navigate to it.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {!chiefComplaint && isInPerson && (
            <Link
              sx={{ cursor: 'pointer' }}
              color="error"
              onClick={() => navigateTo('chief-complaint')}
              data-testid={dataTestIds.progressNotePage.ccLink}
            >
              Chief Complaint
            </Link>
          )}
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
          {suggestionNote && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <WarningAmber sx={{ fontSize: '18px', color: otherColors.orange700 }} />
              <Avatar
                sx={{
                  backgroundColor: '#DCF0FF',
                  color: '#2F79B2',
                  width: '18px',
                  height: '18px',
                  fontWeight: 'bold',
                  fontSize: '10px',
                }}
              >
                AI
              </Avatar>
              <Link sx={{ cursor: 'pointer' }} color="#000000" onClick={() => navigateTo('hpi')}>
                {suggestionNote}
              </Link>
            </div>
          )}
        </Box>
      </Box>
    </AccordionCard>
  );
};
