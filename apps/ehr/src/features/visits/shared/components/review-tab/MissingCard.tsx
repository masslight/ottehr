import { otherColors } from '@ehrTheme/colors';
import { WarningAmber } from '@mui/icons-material';
import { Avatar, Box, Link, Typography } from '@mui/material';
import { FC, useEffect, useState } from 'react';
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
import { computeSignBlockers } from 'utils/lib/easy-chart/sign-blockers';
import { useChartFields } from '../../hooks/useChartFields';
import { useAiSuggestionNotes } from '../../stores/appointment/appointment.queries';
import { useAppointmentData, useChartData } from '../../stores/appointment/appointment.store';

export const MissingCard: FC = () => {
  const { id: appointmentIdFromUrl } = useParams();
  const { encounter } = useAppointmentData();
  const { chartData } = useChartData();
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
  // Same shared, pure rules ReviewAndSignButton gates on — a clean panel here must mean a signable
  // note. NOTE the CC↔HPI storage swap: the HPI text is read from chiefComplaint.text.
  const hpi = chartFields?.chiefComplaint?.text;
  const blockerIds = new Set(
    computeSignBlockers({
      hasPrimaryDiagnosis: (chartData?.diagnosis || []).some((item) => item.isPrimary),
      medicalDecision: chartFields?.medicalDecision?.text,
      hasEmCode: Boolean(chartData?.emCode),
      hpi,
      patientInfoConfirmed: chartFields?.patientInfoConfirmed?.value,
      accident: chartFields?.accident,
      // This card does not request inHouseLabResults and has never listed pending-lab blockers;
      // ReviewAndSignButton fetches them and surfaces them in its tooltip.
      mdmRequired,
    }).map((blocker) => blocker.id)
  );
  const isPatientVerificationMissing = blockerIds.has('patient-info-unconfirmed');
  const accidentMissingDate = blockerIds.has('accident-no-date');
  const accidentMissingState = blockerIds.has('accident-no-state');
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

  // `blockerIds` above is the SAME computation, from the same shared rules and the same chart reads —
  // this card must not claim the note is complete while the sign button refuses it, or vice versa.
  // `suggestionNote` stays separate: it is an AI HPI-quality hint, not a hard blocker. Lab-results
  // blockers are excluded because this card is about MISSING DATA a provider can go and fill in.
  const hasMissingData = [
    'no-primary-dx',
    'no-mdm',
    'no-em',
    'no-hpi',
    'accident-no-date',
    'accident-no-state',
    'patient-info-unconfirmed',
  ].some((id) => blockerIds.has(id));
  if (!hasMissingData && !suggestionNote) {
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
          {blockerIds.has('no-primary-dx') && (
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
          {blockerIds.has('no-mdm') && (
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
          {blockerIds.has('no-em') && (
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
