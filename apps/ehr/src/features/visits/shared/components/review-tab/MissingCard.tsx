import { otherColors } from '@ehrTheme/colors';
import { WarningAmber } from '@mui/icons-material';
import { Avatar, Box, Link, Typography } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AccordionCard } from 'src/components/AccordionCard';
import { LoadingScreen } from 'src/components/LoadingScreen';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getAssessmentUrl, getChiefComplaintUrl, getHPIUrl } from 'src/features/visits/in-person/routing/helpers';
import { useProgressNoteConfig } from 'src/hooks/useProgressNoteConfig';
import { useChartFields } from '../../hooks/useChartFields';
import { useAiSuggestionNotes } from '../../stores/appointment/appointment.queries';
import { useChartData } from '../../stores/appointment/appointment.store';

export const MissingCard: FC = () => {
  const { id: appointmentIdFromUrl } = useParams();
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
      patientInfoConfirmed: {},
      accident: {
        _tag: 'accident',
      },
    },
  });

  const { mutateAsync: aiSuggestionNotes } = useAiSuggestionNotes();
  const { data: progressNoteConfig } = useProgressNoteConfig();
  const mdmRequired = progressNoteConfig?.mdmRequired ?? true;

  const navigate = useNavigate();
  const primaryDiagnosis = (chartData?.diagnosis || []).find((item) => item.isPrimary);
  const medicalDecision = chartFields?.medicalDecision?.text;
  const emCode = chartData?.emCode;
  const hpi = chartFields?.chiefComplaint?.text;
  const patientInfoConfirmed = chartFields?.patientInfoConfirmed?.value;
  const isPatientVerificationMissing = !patientInfoConfirmed;
  const accidentHasType = (chartFields?.accident?.type?.length ?? 0) > 0;
  const accidentMissingDate = accidentHasType && !chartFields?.accident?.date;
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

  if (
    primaryDiagnosis &&
    (!mdmRequired || medicalDecision) &&
    emCode &&
    hpi &&
    !suggestionNote &&
    !isPatientVerificationMissing &&
    !accidentMissingDate
  ) {
    return null;
  }

  const navigateTo = (target: 'patient-info' | 'chief-complaint' | 'hpi' | 'assessment'): void => {
    const inPersonRoutes: Record<'patient-info' | 'chief-complaint' | 'hpi' | 'assessment', string> = {
      'patient-info': getChiefComplaintUrl(appointmentIdFromUrl || ''),
      'chief-complaint': getChiefComplaintUrl(appointmentIdFromUrl || ''),
      hpi: getHPIUrl(appointmentIdFromUrl || ''),
      assessment: getAssessmentUrl(appointmentIdFromUrl || ''),
    };

    requestAnimationFrame(() => {
      navigate(inPersonRoutes[target]);
    });
  };

  return (
    <AccordionCard label="Missing & Warnings" dataTestId={dataTestIds.progressNotePage.missingCard}>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'start', position: 'relative' }}>
        {isFetching && <LoadingScreen />}
        <Typography data-testid={dataTestIds.progressNotePage.missingCardText}>
          Click on the item to navigate to it.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
          {isPatientVerificationMissing && (
            <Link
              component="button"
              sx={{ cursor: 'pointer' }}
              color="error"
              onClick={() => navigateTo('patient-info')}
              data-testid={dataTestIds.progressNotePage.patientVerificationLink}
            >
              Verify Patient&apos;s Name and DOB
            </Link>
          )}
          {!hpi && (
            <Link
              component="button"
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
              component="button"
              sx={{ cursor: 'pointer' }}
              color="error"
              onClick={() => navigateTo('assessment')}
              data-testid={dataTestIds.progressNotePage.primaryDiagnosisLink}
            >
              Primary diagnosis
            </Link>
          )}
          {mdmRequired && !medicalDecision && (
            <Link
              component="button"
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
              component="button"
              sx={{ cursor: 'pointer' }}
              color="error"
              onClick={() => navigateTo('assessment')}
              data-testid={dataTestIds.progressNotePage.emCodeLink}
            >
              E&M code
            </Link>
          )}
          {accidentMissingDate && (
            <Link
              component="button"
              sx={{ cursor: 'pointer' }}
              color="error"
              onClick={() => navigateTo('hpi')}
              data-testid={dataTestIds.progressNotePage.accidentDateLink}
            >
              Date of accident
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
              <Link component="button" sx={{ cursor: 'pointer' }} color="#000000" onClick={() => navigateTo('hpi')}>
                {suggestionNote}
              </Link>
            </div>
          )}
        </Box>
      </Box>
    </AccordionCard>
  );
};
