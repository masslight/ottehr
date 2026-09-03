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
import { hashInput } from 'src/helpers/hash';
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
import { safelyCaptureException } from 'utils/lib/frontend/sentry';
import { AISuggestionNotes } from 'utils/lib/types/api/ai-suggestions-notes';
import { useChartFields } from '../../hooks/useChartFields';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { useAiSuggestionNotes } from '../../stores/appointment/appointment.queries';
import { useAppointmentData, useChartData } from '../../stores/appointment/appointment.store';
import {
  useExamObservationsInitializationStore,
  useExamObservationsStore,
} from '../../stores/appointment/exam-observations.store';
import { usePendingObservationFields } from '../../stores/appointment/pending-observation-fields.store';
import {
  useRosObservationsInitializationStore,
  useRosObservationsStore,
} from '../../stores/appointment/ros-observations.store';
import { useGetVitals } from '../vitals/hooks/useGetVitals';

const AiBadge: FC = () => (
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
);

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

  const {
    data: chartFields,
    isFetching,
    isFetched: isChartFieldsFetched,
  } = useChartFields({
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

  // Non-blocking, AI-generated note-review warnings driven by the practice-level sign-review prompt.
  // The prompt and the note content both live server-side; this only names the visit to review.
  const apiClient = useOystehrAPIClient();
  const { isAppointmentReadOnly } = useGetAppointmentAccessibility();
  const rosState = useRosObservationsStore();
  const examState = useExamObservationsStore();
  const hasRosInitialData = useRosObservationsInitializationStore((state) => state.hasInitialData);
  const hasExamInitialData = useExamObservationsInitializationStore((state) => state.hasInitialData);
  const signReviewPrompt = progressNoteConfig?.signReviewPrompt?.trim();
  // Vitals live outside chart data, and a prompt may well be about them (e.g. DOT color vision), so
  // they have to take part in the cache key. PatientVitalsContainer on this same page already runs
  // this query under the same key, so this shares its result rather than adding a request.
  // isFetched rather than isSuccess: a vitals request that errors must not wedge the review off.
  const { data: vitals, isFetched: isVitalsFetched } = useGetVitals(signReviewPrompt ? encounter?.id : undefined);
  const { hasPendingFields } = usePendingObservationFields();
  // Keyed on the note state this page already knows about, so the AI re-runs when the note changes
  // and not on every mount. None of it is sent — the zambda assembles the note itself.
  const noteStateHash = useMemo(
    () => hashInput([chartData, chartFields, rosState, examState, vitals]),
    [chartData, chartFields, rosState, examState, vitals]
  );
  // The prompt is an input to the AI call, so a prompt edit has to invalidate the cached review.
  const promptHash = useMemo(() => hashInput(signReviewPrompt), [signReviewPrompt]);
  // Only review state that has settled. Firing earlier means either reviewing a chart that is still
  // undefined — several reviews per page load, and warnings that flicker in and out as each source
  // resolves — or reviewing optimistic store state the server has not persisted yet, whose warnings
  // staleTime: Infinity would then pin under a hash that never comes round again.
  const isNoteStateSettled =
    !isChartDataLoading &&
    isChartFieldsFetched &&
    isVitalsFetched &&
    // The ROS and exam stores are hydrated from a parent effect. Waiting for both avoids firing a
    // review against an empty chart and flashing a warning the note doesn't actually deserve.
    hasRosInitialData &&
    hasExamInitialData &&
    !hasPendingFields;

  const {
    data: noteReview,
    isLoading: isNoteReviewLoading,
    isError: isNoteReviewError,
    error: noteReviewError,
  } = useQuery<AISuggestionNotes>({
    queryKey: ['note-review-suggestions', encounter?.id, promptHash, noteStateHash],
    queryFn: () =>
      apiClient!.aiSuggestionNotes({
        type: 'note-review',
        appointmentId: appointmentIdFromUrl!,
        encounterId: encounter!.id!,
      }),
    enabled:
      !!apiClient &&
      !!signReviewPrompt &&
      !!appointmentIdFromUrl &&
      !!encounter?.id &&
      !isAppointmentReadOnly &&
      isNoteStateSettled,
    staleTime: Infinity,
    retry: 0,
  });

  useEffect(() => {
    if (isNoteReviewError) {
      // Carry the query error as the cause: without it every failure class — Vertex 400, an
      // unassemblable note, a network drop — is one indistinguishable message in Sentry.
      safelyCaptureException(
        new Error(`AI note review failed for encounter ${encounter?.id}`, { cause: noteReviewError })
      );
    }
  }, [isNoteReviewError, noteReviewError, encounter?.id]);

  // Defensive: these strings come from a model, and a bad shape must not take down Review & Sign.
  const noteReviewSuggestions = Array.isArray(noteReview?.suggestions) ? noteReview.suggestions : [];
  const showNoteReviewStatus = !!signReviewPrompt && (isNoteReviewLoading || isNoteReviewError);

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
    // Otherwise a complete note whose review failed renders nothing at all, and the provider signs
    // believing the review passed.
    !showNoteReviewStatus
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
              <AiBadge />
              <Link component="button" sx={{ cursor: 'pointer' }} color="#000000" onClick={() => navigateTo('hpi')}>
                {suggestionNote}
              </Link>
            </div>
          )}
          {showNoteReviewStatus && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {isNoteReviewLoading ? (
                <>
                  <CircularProgress size={14} />
                  <Typography color="text.secondary">Reviewing note…</Typography>
                </>
              ) : (
                <Typography color="text.secondary">Note review unavailable</Typography>
              )}
            </Box>
          )}
          {noteReviewSuggestions.map((suggestion, index) => (
            <Box key={`${index}-${suggestion}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <WarningAmber sx={{ fontSize: '18px', color: otherColors.orange700 }} />
              <AiBadge />
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
