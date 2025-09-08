import { otherColors } from '@ehrTheme/colors';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Box, Divider, Stack, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { ImmunizationContainer } from 'src/telemed/features/appointment/ReviewTab/components/ImmunizationContainer';
import { ProceduresContainer } from 'src/telemed/features/appointment/ReviewTab/components/ProceduresContainer';
import { useOystehrAPIClient } from 'src/telemed/hooks/useOystehrAPIClient';
import {
  examConfig,
  getProgressNoteChartDataRequestedFields,
  getVisitStatus,
  LabType,
  NOTE_TYPE,
  TelemedAppointmentStatusEnum,
} from 'utils';
import { dataTestIds } from '../../../../constants/data-test-ids';
import {
  AccordionCard,
  ConfirmationDialog,
  SectionList,
  useAppointmentData,
  useChangeTelemedAppointmentStatusMutation,
  usePatientInstructionsVisibility,
  useSignAppointmentMutation,
} from '../../../../telemed';
import { useChartData } from '../../../../telemed';
import {
  AdditionalQuestionsContainer,
  AllergiesContainer,
  AssessmentContainer,
  ChiefComplaintContainer,
  CPTCodesContainer,
  EMCodeContainer,
  ExaminationContainer,
  LabResultsReviewContainer,
  MedicalConditionsContainer,
  MedicalDecisionMakingContainer,
  MedicationsContainer,
  PatientInstructionsContainer,
  PrescribedMedicationsContainer,
  PrivacyPolicyAcknowledgement,
  ReviewOfSystemsContainer,
  SurgicalHistoryContainer,
} from '../../../../telemed/features/appointment/ReviewTab';
import { useFeatureFlags } from '../../context/featureFlags';
import { useGetImmunizationOrders } from '../../hooks/useImmunization';
import { useMedicationAPI } from '../../hooks/useMedicationOperations';
import { HospitalizationContainer } from './HospitalizationContainer';
import { InHouseMedicationsContainer } from './InHouseMedicationsContainer';
import { PatientVitalsContainer } from './PatientVitalsContainer';

export const ProgressNoteDetails: FC = () => {
  const { appointment, encounter, appointmentRefetch, appointmentSetState } = useAppointmentData();
  const apiClient = useOystehrAPIClient();
  const { css } = useFeatureFlags();
  const { mutateAsync: signAppointment, isPending: isSignLoading } = useSignAppointmentMutation();
  const { mutateAsync: changeTelemedAppointmentStatus, isPending: isChangeLoading } =
    useChangeTelemedAppointmentStatusMutation();
  const isLoading = isChangeLoading || isSignLoading;

  const { chartData } = useChartData();

  const { setPartialChartData } = useChartData({
    requestedFields: getProgressNoteChartDataRequestedFields(),
    onSuccess: (data) => {
      setPartialChartData({
        episodeOfCare: data?.episodeOfCare,
        vitalsObservations: data?.vitalsObservations,
        prescribedMedications: data?.prescribedMedications,
        externalLabResults: data?.externalLabResults,
        inHouseLabResults: data?.inHouseLabResults,
        disposition: data?.disposition,
        medicalDecision: data?.medicalDecision,
      });
    },
  });

  const { medications: inHouseMedicationsWithCanceled } = useMedicationAPI();
  const inHouseMedications = inHouseMedicationsWithCanceled.filter((medication) => medication.status !== 'cancelled');
  const { data: immunizationOrdersResponse } = useGetImmunizationOrders({
    encounterId: encounter.id,
  });
  const immunizationOrders = (immunizationOrdersResponse?.orders ?? []).filter((order) =>
    ['administered', 'administered-partly'].includes(order.status)
  );
  const screeningNotes = chartData?.notes?.filter((note) => note.type === NOTE_TYPE.SCREENING);
  const vitalsNotes = chartData?.notes?.filter((note) => note.type === NOTE_TYPE.VITALS);
  const allergyNotes = chartData?.notes?.filter((note) => note.type === NOTE_TYPE.ALLERGY);
  const intakeMedicationNotes = chartData?.notes?.filter((note) => note.type === NOTE_TYPE.INTAKE_MEDICATION);
  const hospitalizationNotes = chartData?.notes?.filter((note) => note.type === NOTE_TYPE.HOSPITALIZATION);
  const medicalConditionNotes = chartData?.notes?.filter((note) => note.type === NOTE_TYPE.MEDICAL_CONDITION);
  const surgicalHistoryNotes = chartData?.notes?.filter((note) => note.type === NOTE_TYPE.SURGICAL_HISTORY);
  const inHouseMedicationNotes = chartData?.notes?.filter((note) => note.type === NOTE_TYPE.MEDICATION);

  const chiefComplaint = chartData?.chiefComplaint?.text;
  const ros = chartData?.ros?.text;
  const diagnoses = chartData?.diagnosis;
  const medicalDecision = chartData?.medicalDecision?.text;
  const emCode = chartData?.emCode;
  const cptCodes = chartData?.cptCodes;
  const prescriptions = chartData?.prescribedMedications;
  const observations = chartData?.observations;
  const vitalsObservations = chartData?.vitalsObservations;
  const externalLabResults = chartData?.externalLabResults;
  const inHouseLabResults = chartData?.inHouseLabResults;

  const showChiefComplaint = !!(chiefComplaint && chiefComplaint.length > 0);
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

  let isAwaitingSupervisorApproval = false;
  if (appointment) {
    isAwaitingSupervisorApproval =
      getVisitStatus(appointment, encounter, FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED) ===
      'awaiting supervisor approval';
  }

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
    showReviewOfSystems && <ReviewOfSystemsContainer />,
    showAdditionalQuestions && <AdditionalQuestionsContainer notes={screeningNotes} />,
    showVitalsObservations && <PatientVitalsContainer notes={vitalsNotes} encounterId={encounter?.id} />,
    <Stack spacing={1}>
      <Typography variant="h5" color="primary.dark">
        Examination
      </Typography>
      <ExaminationContainer examConfig={examConfig.inPerson.default.components} />
    </Stack>,
    <AllergiesContainer notes={allergyNotes} />,
    <MedicationsContainer notes={intakeMedicationNotes} />,
    <MedicalConditionsContainer notes={medicalConditionNotes} />,
    <SurgicalHistoryContainer notes={surgicalHistoryNotes} />,
    <HospitalizationContainer notes={hospitalizationNotes} />,
    showInHouseMedications && (
      <InHouseMedicationsContainer medications={inHouseMedications} notes={inHouseMedicationNotes} />
    ),
    showImmunization && <ImmunizationContainer orders={immunizationOrders} />,
    ...(!isAwaitingSupervisorApproval ? medicalHistorySections : []),
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

    if (css) {
      const tz = DateTime.now().zoneName;
      await signAppointment({
        apiClient,
        appointmentId: appointment.id + 'a',
        timezone: tz,
        supervisorApprovalEnabled: FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED,
      });
      await appointmentRefetch();
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
      {FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED && isAwaitingSupervisorApproval && (
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
              <ConfirmationDialog
                title="Supervisor Approval"
                description={'Are you sure you want to approve this visit? Claim will be sent to RCM.'}
                response={handleApprove}
                actionButtons={{
                  back: { text: 'Cancel' },
                  proceed: { text: 'Approve', loading: isLoading },
                  reverse: true,
                }}
              >
                {(showDialog) => (
                  <RoundedButton variant="contained" size="small" onClick={showDialog}>
                    Confirm
                  </RoundedButton>
                )}
              </ConfirmationDialog>
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
