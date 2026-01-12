import { otherColors } from '@ehrTheme/colors';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Box, Divider, Stack, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccordionCard } from 'src/components/AccordionCard';
import { ApptTab } from 'src/components/AppointmentTabs';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { ImmunizationContainer } from 'src/features/visits/in-person/components/ImmunizationContainer';
import { LabResultsReviewContainer } from 'src/features/visits/in-person/components/LabResultsReviewContainer';
import { AdditionalQuestionsContainer } from 'src/features/visits/shared/components/review-tab/components/AdditionalQuestionsContainer';
import { AllergiesContainer } from 'src/features/visits/shared/components/review-tab/components/AllergiesContainer';
import { AssessmentContainer } from 'src/features/visits/shared/components/review-tab/components/AssessmentContainer';
import { ChiefComplaintContainer } from 'src/features/visits/shared/components/review-tab/components/ChiefComplaintContainer';
import { CPTCodesContainer } from 'src/features/visits/shared/components/review-tab/components/CPTCodesContainer';
import { EMCodeContainer } from 'src/features/visits/shared/components/review-tab/components/EMCodeContainer';
import { ExaminationContainer } from 'src/features/visits/shared/components/review-tab/components/ExaminationContainer';
import { HistoryOfPresentIllnessContainer } from 'src/features/visits/shared/components/review-tab/components/HistoryOfPresentIllnessContainer';
import { MechanismOfInjuryContainer } from 'src/features/visits/shared/components/review-tab/components/MechanismOfInjuryContainer';
import { MedicalConditionsContainer } from 'src/features/visits/shared/components/review-tab/components/MedicalConditionsContainer';
import { MedicalDecisionMakingContainer } from 'src/features/visits/shared/components/review-tab/components/MedicalDecisionMakingContainer';
import { MedicationsContainer } from 'src/features/visits/shared/components/review-tab/components/MedicationsContainer';
import { PatientInstructionsContainer } from 'src/features/visits/shared/components/review-tab/components/PatientInstructionsContainer';
import { PrescribedMedicationsContainer } from 'src/features/visits/shared/components/review-tab/components/PrescribedMedicationsContainer';
import { PrivacyPolicyAcknowledgement } from 'src/features/visits/shared/components/review-tab/components/PrivacyPolicyAcknowledgement';
import { ProceduresContainer } from 'src/features/visits/shared/components/review-tab/components/ProceduresContainer';
import { ReviewOfSystemsContainer } from 'src/features/visits/shared/components/review-tab/components/ReviewOfSystemsContainer';
import { SurgicalHistoryContainer } from 'src/features/visits/shared/components/review-tab/components/SurgicalHistoryContainer';
import { SectionList } from 'src/features/visits/shared/components/SectionList';
import { useChartFields } from 'src/features/visits/shared/hooks/useChartFields';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { usePatientInstructionsVisibility } from 'src/features/visits/shared/hooks/usePatientInstructionsVisibility';
import { useAppointmentData, useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useAppFlags } from 'src/features/visits/shared/stores/contexts/useAppFlags';
import {
  useChangeTelemedAppointmentStatusMutation,
  useSignAppointmentMutation,
} from 'src/features/visits/shared/stores/tracking-board/tracking-board.queries';
import { isEligibleSupervisor } from 'src/helpers';
import useEvolveUser from 'src/hooks/useEvolveUser';
import {
  examConfig,
  getSupervisorApprovalStatus,
  LabType,
  NOTE_TYPE,
  progressNoteChartDataRequestedFields,
  TelemedAppointmentStatusEnum,
} from 'utils';
import { useGetImmunizationOrders } from '../../hooks/useImmunization';
import { useMedicationAPI } from '../../hooks/useMedicationOperations';
import { HospitalizationContainer } from './HospitalizationContainer';
import { InHouseMedicationsContainer } from './InHouseMedicationsContainer';
import { PatientVitalsContainer } from './PatientVitalsContainer';

export const ProgressNoteDetails: FC = () => {
  const { appointment, encounter, appointmentSetState } = useAppointmentData();
  const apiClient = useOystehrAPIClient();
  const { isInPerson } = useAppFlags();
  const { mutateAsync: signAppointment, isPending: isSignLoading } = useSignAppointmentMutation();

  const { mutateAsync: changeTelemedAppointmentStatus, isPending: isChangeLoading } =
    useChangeTelemedAppointmentStatusMutation();

  const isLoading = isChangeLoading || isSignLoading;
  const user = useEvolveUser();
  const navigate = useNavigate();

  const { data: chartFields } = useChartFields({ requestedFields: progressNoteChartDataRequestedFields });
  const { chartData } = useChartData();
  const { medications: inHouseMedications } = useMedicationAPI();

  const { data: immunizationOrdersResponse } = useGetImmunizationOrders({
    encounterId: encounter.id,
  });

  const immunizationOrders = (immunizationOrdersResponse?.orders ?? []).filter((order) =>
    ['administered', 'administered-partly'].includes(order.status)
  );

  const screeningNotes = chartFields?.notes?.filter((note) => note.type === NOTE_TYPE.SCREENING);
  const vitalsNotes = chartFields?.notes?.filter((note) => note.type === NOTE_TYPE.VITALS);
  const allergyNotes = chartFields?.notes?.filter((note) => note.type === NOTE_TYPE.ALLERGY);
  const intakeMedicationNotes = chartFields?.notes?.filter((note) => note.type === NOTE_TYPE.INTAKE_MEDICATION);
  const hospitalizationNotes = chartFields?.notes?.filter((note) => note.type === NOTE_TYPE.HOSPITALIZATION);
  const medicalConditionNotes = chartFields?.notes?.filter((note) => note.type === NOTE_TYPE.MEDICAL_CONDITION);
  const surgicalHistoryNotes = chartFields?.notes?.filter((note) => note.type === NOTE_TYPE.SURGICAL_HISTORY);
  const inHouseMedicationNotes = chartFields?.notes?.filter((note) => note.type === NOTE_TYPE.MEDICATION);
  const medicalDecision = chartFields?.medicalDecision?.text;
  const prescriptions = chartFields?.prescribedMedications;
  const vitalsObservations = chartFields?.vitalsObservations;
  const externalLabResults = chartFields?.externalLabResults;
  const inHouseLabResults = chartFields?.inHouseLabResults;
  const chiefComplaint = chartFields?.historyOfPresentIllness?.text;
  const mechanismOfInjury = chartFields?.mechanismOfInjury?.text;
  const hpi = chartFields?.chiefComplaint?.text;
  const ros = chartFields?.ros?.text;

  const emCode = chartData?.emCode;
  const cptCodes = chartData?.cptCodes;
  const diagnoses = chartData?.diagnosis;
  const observations = chartData?.observations;

  const showChiefComplaint = !!(chiefComplaint && chiefComplaint.length > 0);
  const showMechanismOfInjury = !!(mechanismOfInjury && mechanismOfInjury.length > 0);
  const showHpi = !!(hpi && hpi.length > 0);
  const showReviewOfSystems = !!(ros && ros.length > 0);
  const showAdditionalQuestions =
    !!(observations && observations.length > 0) || !!(screeningNotes && screeningNotes.length > 0);
  const showAssessment = !!(diagnoses && diagnoses.length > 0);
  const showMedicalDecisionMaking = !!(medicalDecision && medicalDecision.length > 0);
  const showEmCode = !!emCode;
  const showCptCodes = !!(cptCodes && cptCodes.length > 0);
  const showExternalLabsResultsContainer = !!(
    externalLabResults?.resultsPending ||
    (externalLabResults?.labOrderResults && externalLabResults?.labOrderResults.length > 0)
  );
  const showInHouseLabsResultsContainer = !!(
    inHouseLabResults?.resultsPending ||
    (inHouseLabResults?.labOrderResults && inHouseLabResults?.labOrderResults.length > 0)
  );
  const showProceduresContainer = (chartData?.procedures?.length ?? 0) > 0;
  const showPrescribedMedications = !!(prescriptions && prescriptions.length > 0);
  const { showPatientInstructions } = usePatientInstructionsVisibility();
  const showInHouseMedications =
    !!(inHouseMedications && inHouseMedications.length > 0) ||
    !!(inHouseMedicationNotes && inHouseMedicationNotes.length > 0);
  const showImmunization = immunizationOrders.length > 0;

  const showVitalsObservations =
    !!(vitalsObservations && vitalsObservations.length > 0) || !!(vitalsNotes && vitalsNotes.length > 0);

  const approvalStatus = FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED
    ? getSupervisorApprovalStatus(appointment, encounter)
    : 'unknown';

  const medicalHistorySections = [
    <AllergiesContainer notes={allergyNotes} />,
    <MedicationsContainer notes={intakeMedicationNotes} />,
    <MedicalConditionsContainer notes={medicalConditionNotes} />,
    <SurgicalHistoryContainer notes={surgicalHistoryNotes} />,
    <HospitalizationContainer notes={hospitalizationNotes} />,
    showInHouseMedications && (
      <InHouseMedicationsContainer medications={inHouseMedications} notes={inHouseMedicationNotes} />
    ),
    showImmunization && <ImmunizationContainer orders={immunizationOrders} />,
  ].filter(Boolean);

  const sections = [
    showChiefComplaint && <ChiefComplaintContainer />,
    showHpi && <HistoryOfPresentIllnessContainer />,
    showMechanismOfInjury && <MechanismOfInjuryContainer />,
    showReviewOfSystems && <ReviewOfSystemsContainer />,
    showAdditionalQuestions && <AdditionalQuestionsContainer notes={screeningNotes} />,
    showVitalsObservations && <PatientVitalsContainer notes={vitalsNotes} encounterId={encounter?.id} />,
    <Stack spacing={1}>
      <Typography variant="h5" color="primary.dark">
        Examination
      </Typography>
      <ExaminationContainer examConfig={examConfig.inPerson.default.components} />
    </Stack>,
    ...(!(approvalStatus === 'waiting-for-approval') ? medicalHistorySections : []),
    showAssessment && <AssessmentContainer />,
    showMedicalDecisionMaking && <MedicalDecisionMakingContainer />,
    showEmCode && <EMCodeContainer />,
    showCptCodes && <CPTCodesContainer />,
    showInHouseLabsResultsContainer && (
      <LabResultsReviewContainer
        resultDetails={{ type: LabType.inHouse, results: inHouseLabResults.labOrderResults }}
        resultsPending={inHouseLabResults.resultsPending}
      />
    ),
    showExternalLabsResultsContainer && (
      <LabResultsReviewContainer
        resultDetails={{ type: LabType.external, results: externalLabResults.labOrderResults }}
        resultsPending={externalLabResults.resultsPending}
      />
    ),
    showProceduresContainer && <ProceduresContainer />,
    showPrescribedMedications && <PrescribedMedicationsContainer />,
    showPatientInstructions && <PatientInstructionsContainer />,
    <PrivacyPolicyAcknowledgement />,
  ].filter(Boolean);

  const handleApprove = async (): Promise<void> => {
    if (!apiClient || !appointment?.id) {
      throw new Error('api client not defined or appointmentId not provided');
    }

    if (isInPerson) {
      const tz = DateTime.now().zoneName;
      await signAppointment({
        apiClient,
        appointmentId: appointment.id,
        timezone: tz,
        supervisorApprovalEnabled: FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED,
        encounterId: encounter.id!,
      });
      navigate('/visits', { state: { tab: ApptTab.completed } });
    } else {
      await changeTelemedAppointmentStatus({
        apiClient,
        appointmentId: appointment.id,
        newStatus: TelemedAppointmentStatusEnum.complete,
      });
      appointmentSetState({
        encounter: { ...encounter, status: 'finished' },
        appointment: { ...appointment, status: 'fulfilled' },
      });
    }
  };

  return (
    <AccordionCard label="Visit Note" dataTestId={dataTestIds.progressNotePage.visitNoteCard}>
      {FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED &&
        approvalStatus === 'waiting-for-approval' &&
        user &&
        isEligibleSupervisor(user.profileResource!) && (
          <>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                mt: 1.5,
                mx: 2,
                mb: 1,
                p: 2,
                border: 1,
                borderColor: otherColors.warningBorder,
                borderRadius: 2,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  width: 'fit-content',
                  marginTop: 1,
                  px: 2,
                  py: 1,
                  borderRadius: 0.5,
                  gap: 1.5,
                  alignItems: 'center',
                  bgcolor: otherColors.lightErrorBg,
                }}
              >
                <ErrorOutlineIcon sx={{ color: otherColors.warningIcon }} />
                <Typography color={otherColors.warningText} fontWeight={600}>
                  Medical History should be confirmed by the provider
                </Typography>
                <RoundedButton variant="contained" size="small" onClick={handleApprove} loading={isLoading}>
                  Approve
                </RoundedButton>
              </Box>

              <SectionList sections={medicalHistorySections} />
            </Box>
            <Divider />
          </>
        )}
      <SectionList sections={sections} sx={{ p: 2 }} />
    </AccordionCard>
  );
};
