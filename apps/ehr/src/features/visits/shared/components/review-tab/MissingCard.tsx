import { otherColors } from '@ehrTheme/colors';
import { WarningAmber } from '@mui/icons-material';
import { Avatar, Box, CircularProgress, Link, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { FC, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AccordionCard } from 'src/components/AccordionCard';
import { LoadingScreen } from 'src/components/LoadingScreen';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  getAssessmentUrl,
  getChiefComplaintUrl,
  getExternalLabOrderCreateUrl,
  getHPIUrl,
  getImmunizationNewOrderUrl,
  getInHouseLabOrderCreateUrl,
  getNewMedicationOrderUrl,
  getNewProceduresUrl,
  getNursingOrderCreateUrl,
  getRadiologyOrderCreateUrl,
  getVitalsUrl,
} from 'src/features/visits/in-person/routing/helpers';
import { useProgressNoteConfig } from 'src/hooks/useProgressNoteConfig';
import {
  useCreateExternalLabStore,
  useCreateInHouseLabStore,
  useCreateRadiologyOrderStore,
  useImmunizationOrderStore,
  useInHouseMedicationOrderStore,
  useNursingOrderStore,
  useProcedureStore,
  useVitalsDraftStore,
} from 'src/state/draft-data.store';
import { extractObservationsFromExamComponents } from 'utils/lib/config-helpers/exam-observations';
import { examConfig } from 'utils/lib/ottehr-config/examination';
import { InPersonRosConfig, rosField, RosFindingState } from 'utils/lib/ottehr-config/review-of-systems';
import { AISuggestionNotes } from 'utils/lib/types/api/ai-suggestions-notes';
import { ExamObservationDTO, VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetVitalsResponseData } from 'utils/lib/types/api/chart-data/get-vitals.types';
import { hashInput } from '../../hooks/useBillingSuggestions';
import { useChartFields } from '../../hooks/useChartFields';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { useAiSuggestionNotes } from '../../stores/appointment/appointment.queries';
import { useAppointmentData, useChartData } from '../../stores/appointment/appointment.store';
import { useExamObservationsStore } from '../../stores/appointment/exam-observations.store';
import { useRosObservationsStore } from '../../stores/appointment/ros-observations.store';
import { useGetVitals } from '../vitals/hooks/useGetVitals';

// Compact text serialization of the note sections the practice-level sign-review prompt may evaluate
const serializeVitals = (vitals: GetVitalsResponseData | undefined): string[] => {
  return Object.entries(vitals ?? {}).flatMap(([field, observations]) =>
    (observations as VitalsObservationDTO[]).map((obs) => {
      const label = field.replace(/^vital-/, '').replace(/-/g, ' ');
      const value =
        'systolicPressure' in obs ? `${obs.systolicPressure}/${obs.diastolicPressure}` : String(obs.value ?? '');
      return `${label}: ${value}`;
    })
  );
};

const serializeNoteDetails = (
  rosState: Record<string, ExamObservationDTO>,
  examState: Record<string, ExamObservationDTO>,
  hpi: string | undefined,
  mdm: string | undefined,
  vitals: GetVitalsResponseData | undefined
): string => {
  const rosLines = Object.values(InPersonRosConfig).flatMap((system) => {
    const items = Object.entries(system.items).flatMap(([baseKey, item]) =>
      [RosFindingState.Denies, RosFindingState.Reports]
        .filter((state) => rosState[rosField(baseKey, state)]?.value === true)
        .map((state) => `${state} ${item.label} (checked)`)
    );
    return items.length > 0 ? [`${system.label}: ${items.join(', ')}`] : [];
  });
  const examLines = Object.entries(examConfig.default.components).flatMap(([, section]) => {
    const items = [
      ...extractObservationsFromExamComponents(section.components.normal, 'normal', examState),
      ...extractObservationsFromExamComponents(section.components.abnormal, 'abnormal', examState),
    ].map((item) => `${item.label}${item.abnormal ? ' (abnormal)' : ''} (checked)`);
    return items.length > 0 ? [`${section.label}: ${items.join(', ')}`] : [];
  });
  return [
    `HPI: ${hpi ?? ''}`,
    `MDM: ${mdm ?? ''}`,
    'VITALS:',
    ...serializeVitals(vitals),
    'ROS:',
    ...rosLines,
    'EXAM:',
    ...examLines,
  ].join('\n');
};

export const MissingCard: FC = () => {
  const { id: appointmentIdFromUrl } = useParams();
  const { encounter } = useAppointmentData();
  const { chartData, isLoading: isChartDataLoading } = useChartData();
  const { hasDraft: hasExternalLabDraft } = useCreateExternalLabStore();
  const { hasDraft: hasInHouseLabDraft } = useCreateInHouseLabStore();
  const { hasDraft: hasRadiologyDraft } = useCreateRadiologyOrderStore();
  const { hasDraft: hasProcedureDraft } = useProcedureStore();
  const { hasDraft: hasNursingOrderDraft } = useNursingOrderStore();
  const { hasDraft: hasImmunizationDraft } = useImmunizationOrderStore();
  const { hasDraft: hasMedDraft } = useInHouseMedicationOrderStore();
  const { hasDraft: hasVitalsDraft } = useVitalsDraftStore();

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
  const isAutoAccident = chartFields?.accident?.type?.includes('AA') ?? false;
  const hasAccidentType = (chartFields?.accident?.type?.length ?? 0) > 0;
  const accidentMissingDate = hasAccidentType && !chartFields?.accident?.date;
  const accidentMissingState = isAutoAccident && !chartFields?.accident?.state;
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

  // Non-blocking, AI-generated note-review warnings driven by the practice-level sign-review prompt
  const apiClient = useOystehrAPIClient();
  const { isAppointmentReadOnly } = useGetAppointmentAccessibility();
  const rosState = useRosObservationsStore();
  const examState = useExamObservationsStore();
  const signReviewPrompt = progressNoteConfig?.signReviewPrompt?.trim();
  const { data: vitals, isLoading: isVitalsLoading } = useGetVitals(signReviewPrompt ? encounter.id : undefined);
  const noteDetails = useMemo(
    () => (signReviewPrompt ? serializeNoteDetails(rosState, examState, hpi, medicalDecision, vitals) : ''),
    [signReviewPrompt, rosState, examState, hpi, medicalDecision, vitals]
  );
  const { data: noteReview, isLoading: isNoteReviewLoading } = useQuery<AISuggestionNotes>({
    queryKey: ['note-review-suggestions', encounter.id, hashInput(signReviewPrompt + noteDetails)],
    queryFn: () => apiClient!.aiSuggestionNotes({ type: 'note-review', reviewPrompt: signReviewPrompt!, noteDetails }),
    enabled:
      !!apiClient &&
      !!signReviewPrompt &&
      !!encounter.id &&
      !isAppointmentReadOnly &&
      !isChartDataLoading &&
      !isVitalsLoading,
    staleTime: Infinity,
    retry: 0,
  });
  const noteReviewSuggestions = (signReviewPrompt && noteReview?.suggestions) || [];

  if (
    primaryDiagnosis &&
    (!mdmRequired || medicalDecision) &&
    emCode &&
    hpi &&
    !suggestionNote &&
    !isPatientVerificationMissing &&
    !accidentMissingDate &&
    !accidentMissingState &&
    noteReviewSuggestions.length === 0 &&
    !isNoteReviewLoading
  ) {
    return null;
  }

  type NavigationKey =
    | 'patient-info'
    | 'chief-complaint'
    | 'hpi'
    | 'assessment'
    | 'external-lab'
    | 'in-house-lab'
    | 'radiology'
    | 'procedure'
    | 'nursing-order'
    | 'immunization'
    | 'in-house-med'
    | 'vitals';
  const navigateTo = (target: NavigationKey): void => {
    const inPersonRoutes: Record<NavigationKey, string> = {
      'patient-info': getChiefComplaintUrl(appointmentIdFromUrl || ''),
      'chief-complaint': getChiefComplaintUrl(appointmentIdFromUrl || ''),
      hpi: getHPIUrl(appointmentIdFromUrl || ''),
      assessment: getAssessmentUrl(appointmentIdFromUrl || ''),
      'external-lab': getExternalLabOrderCreateUrl(appointmentIdFromUrl || ''),
      'in-house-lab': getInHouseLabOrderCreateUrl(appointmentIdFromUrl ?? ''),
      radiology: getRadiologyOrderCreateUrl(appointmentIdFromUrl || ''),
      procedure: getNewProceduresUrl(appointmentIdFromUrl ?? ''),
      'nursing-order': getNursingOrderCreateUrl(appointmentIdFromUrl ?? ''),
      immunization: getImmunizationNewOrderUrl(appointmentIdFromUrl ?? ''),
      'in-house-med': getNewMedicationOrderUrl(appointmentIdFromUrl ?? ''),
      vitals: getVitalsUrl(appointmentIdFromUrl ?? ''),
    };

    requestAnimationFrame(() => {
      navigate(inPersonRoutes[target]);
    });
  };

  return (
    <AccordionCard label="Missing & Warnings" dataTestId={dataTestIds.progressNotePage.missingCard}>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'start', position: 'relative' }}>
        {isFetching && <LoadingScreen />}
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
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <Link
                component="button"
                sx={{ cursor: 'pointer' }}
                color="error"
                onClick={() => navigateTo('hpi')}
                data-testid={dataTestIds.progressNotePage.accidentDateLink}
              >
                Date of Accident
              </Link>
              <Typography variant="body2" color="error">
                The information is missing from the HPI/MOI & Templates screen. Click on the item to complete.
              </Typography>
            </Box>
          )}
          {accidentMissingState && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <Link
                component="button"
                sx={{ cursor: 'pointer' }}
                color="error"
                onClick={() => navigateTo('hpi')}
                data-testid={dataTestIds.progressNotePage.accidentStateLink}
              >
                State
              </Link>
              <Typography variant="body2" color="error">
                The information is missing from the HPI/MOI & Templates screen. Click on the item to complete.
              </Typography>
            </Box>
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
          {isNoteReviewLoading && <CircularProgress size={14} />}
          {noteReviewSuggestions.map((suggestion) => (
            <Box key={suggestion} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <WarningAmber sx={{ fontSize: '18px', color: otherColors.orange700 }} />
              <Typography>{suggestion}</Typography>
            </Box>
          ))}
          {encounter?.id && (
            <>
              {hasExternalLabDraft(encounter.id) && (
                <Link
                  component="button"
                  sx={{ cursor: 'pointer' }}
                  color="error"
                  onClick={() => navigateTo('external-lab')}
                >
                  Draft External Lab Order
                </Link>
              )}
              {hasInHouseLabDraft(encounter.id) && (
                <Link
                  component="button"
                  sx={{ cursor: 'pointer' }}
                  color="error"
                  onClick={() => navigateTo('in-house-lab')}
                >
                  Draft In-House Lab Order
                </Link>
              )}
              {hasRadiologyDraft(encounter.id) && (
                <Link
                  component="button"
                  sx={{ cursor: 'pointer' }}
                  color="error"
                  onClick={() => navigateTo('radiology')}
                >
                  Draft Radiology Order
                </Link>
              )}
              {hasProcedureDraft(encounter.id) && (
                <Link
                  component="button"
                  sx={{ cursor: 'pointer' }}
                  color="error"
                  onClick={() => navigateTo('procedure')}
                >
                  Draft Procedure
                </Link>
              )}
              {hasNursingOrderDraft(encounter.id) && (
                <Link
                  component="button"
                  sx={{ cursor: 'pointer' }}
                  color="error"
                  onClick={() => navigateTo('nursing-order')}
                >
                  Draft Nursing Order
                </Link>
              )}
              {hasImmunizationDraft(encounter.id) && (
                <Link
                  component="button"
                  sx={{ cursor: 'pointer' }}
                  color="error"
                  onClick={() => navigateTo('immunization')}
                >
                  Draft Immunization
                </Link>
              )}
              {hasMedDraft(encounter.id) && (
                <Link
                  component="button"
                  sx={{ cursor: 'pointer' }}
                  color="error"
                  onClick={() => navigateTo('in-house-med')}
                >
                  Draft In-House Medication
                </Link>
              )}
              {hasVitalsDraft(encounter.id) && (
                <Link component="button" sx={{ cursor: 'pointer' }} color="error" onClick={() => navigateTo('vitals')}>
                  Draft Vitals
                </Link>
              )}
            </>
          )}
        </Box>
      </Box>
    </AccordionCard>
  );
};
