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
import { AssessmentBody } from 'src/features/visits/shared/components/assessment-tab/AssessmentBody';
import { ExamBody } from 'src/features/visits/shared/components/exam-tab/ExamBody';
import { ExamMigrationWarning } from 'src/features/visits/shared/components/exam-tab/ExamMigrationWarning';
import { useExamConfigState } from 'src/features/visits/shared/components/exam-tab/useExamConfigState';
import { AdditionalQuestionsContainer } from 'src/features/visits/shared/components/review-tab/components/AdditionalQuestionsContainer';
import { AllergiesContainer } from 'src/features/visits/shared/components/review-tab/components/AllergiesContainer';
import { AssessmentGroupContainer } from 'src/features/visits/shared/components/review-tab/components/AssessmentGroupContainer';
import { ChiefComplaintContainer } from 'src/features/visits/shared/components/review-tab/components/ChiefComplaintContainer';
import { ExaminationContainer } from 'src/features/visits/shared/components/review-tab/components/ExaminationContainer';
import { HpiMoiContainer } from 'src/features/visits/shared/components/review-tab/components/HpiMoiContainer';
import { MedicalConditionsContainer } from 'src/features/visits/shared/components/review-tab/components/MedicalConditionsContainer';
import { MedicationsContainer } from 'src/features/visits/shared/components/review-tab/components/MedicationsContainer';
import { PatientInstructionsContainer } from 'src/features/visits/shared/components/review-tab/components/PatientInstructionsContainer';
import { PrescribedMedicationsContainer } from 'src/features/visits/shared/components/review-tab/components/PrescribedMedicationsContainer';
import { PrivacyPolicyAcknowledgement } from 'src/features/visits/shared/components/review-tab/components/PrivacyPolicyAcknowledgement';
import { ProceduresContainer } from 'src/features/visits/shared/components/review-tab/components/ProceduresContainer';
import { RadiologyOrdersContainer } from 'src/features/visits/shared/components/review-tab/components/RadiologyOrdersContainer';
import { ReviewOfSystemsContainer } from 'src/features/visits/shared/components/review-tab/components/ReviewOfSystemsContainer';
import { SurgicalHistoryContainer } from 'src/features/visits/shared/components/review-tab/components/SurgicalHistoryContainer';
import { RosBody } from 'src/features/visits/shared/components/ros-tab/RosBody';
import { RosReviewContainer } from 'src/features/visits/shared/components/ros-tab/RosReviewContainer';
import { SectionList } from 'src/features/visits/shared/components/SectionList';
import { useChartFields } from 'src/features/visits/shared/hooks/useChartFields';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { usePatientInstructionsVisibility } from 'src/features/visits/shared/hooks/usePatientInstructionsVisibility';
import { useAppointmentData, useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useRosObservationsStore } from 'src/features/visits/shared/stores/appointment/ros-observations.store';
import { useSignAppointmentMutation } from 'src/features/visits/shared/stores/tracking-board/tracking-board.queries';
import { isEligibleSupervisor } from 'src/helpers';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { INCOMPATIBLE_EXAM_VERSION_MESSAGE } from 'utils/lib/fhir/constants';
import { progressNoteChartDataRequestedFields } from 'utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper';
import { examConfig } from 'utils/lib/ottehr-config/examination';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { LabType } from 'utils/lib/types/data/labs/labs.types';
import { getSupervisorApprovalStatus } from 'utils/lib/utils/visitUtils';
import { useGetImmunizationOrders } from '../../hooks/useImmunization';
import { useMedicationAPI } from '../../hooks/useMedicationOperations';
import { AllergiesBody } from '../allergies/AllergiesBody';
import { ChiefComplaintBody } from '../chief-complaint/ChiefComplaintBody';
import { HospitalizationBody } from '../hospitalization/HospitalizationBody';
import { HistoryAndTemplatesBody } from '../hpi/HistoryAndTemplatesBody';
import { MedicalConditionsBody } from '../medical-conditions/MedicalConditionsBody';
import { MedicationsBody } from '../medications/MedicationsBody';
import { PlanBody } from '../plan/PlanBody';
import { ScreeningBody } from '../screening/ScreeningBody';
import { SurgicalHistoryBody } from '../surgical-history/SurgicalHistoryBody';
import { PatientVitalsBody } from '../vitals/PatientVitalsBody';
import { BlankSection } from './BlankSection';
import { ERXInlineFlow } from './ERXInlineFlow';
import { ExternalLabsInlineFlow } from './ExternalLabsInlineFlow';
import { HospitalizationContainer } from './HospitalizationContainer';
import { ImmunizationInlineFlow } from './ImmunizationInlineFlow';
import { InHouseLabsInlineFlow } from './InHouseLabsInlineFlow';
import { InHouseMedicationsContainer } from './InHouseMedicationsContainer';
import { InHouseMedicationsInlineFlow } from './InHouseMedicationsInlineFlow';
import { InlineEditSection } from './InlineEditSection';
import { SectionWithIcon } from './NoteSectionIcon';
import { NursingOrdersReviewContainer } from './NursingOrdersReviewContainer';
import { PatientVitalsContainer } from './PatientVitalsContainer';
import { ProceduresInlineFlow } from './ProceduresInlineFlow';
import { RadiologyInlineFlow } from './RadiologyInlineFlow';

export const ProgressNoteDetails: FC = () => {
  const { appointment, encounter } = useAppointmentData();
  const apiClient = useOystehrAPIClient();
  // Appointment-scoped: must match how save-chart-data picks the config, otherwise
  // telemed appointments opened under /in-person/:id/* mismatch the backend.
  const examConfigComponents = examConfig.default.components;
  const { unmatchedExamFields, displayExamMigrationWarning, hasIncompatibleExamConfig } =
    useExamConfigState(examConfigComponents);
  const { mutateAsync: signAppointment, isPending: isSignLoading } = useSignAppointmentMutation();
  const rosState = useRosObservationsStore();

  const isLoading = isSignLoading;
  const user = useEvolveUser();
  const navigate = useNavigate();

  const { data: chartFields } = useChartFields({ requestedFields: progressNoteChartDataRequestedFields });
  const { chartData } = useChartData();
  const { medications: inHouseMedications } = useMedicationAPI();

  const { data: immunizationOrdersResponse } = useGetImmunizationOrders({
    encounterIds: [encounter.id!],
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
  const radiologyOrders = chartFields?.radiologyOrders;
  const chiefComplaint = chartFields?.historyOfPresentIllness?.text;
  const reasonForVisit = chartFields?.reasonForVisit?.text;
  const mechanismOfInjury = chartFields?.mechanismOfInjury?.text;
  const hpi = chartFields?.chiefComplaint?.text;
  const rosLegacyText = chartFields?.ros?.text;

  const emCode = chartData?.emCode;
  const cptCodes = chartData?.cptCodes;
  const diagnoses = chartData?.diagnosis;
  const observations = chartData?.observations;

  const showChiefComplaint = !!(chiefComplaint && chiefComplaint.length > 0);
  const showReasonForVisit = !!(reasonForVisit && reasonForVisit.length > 0);
  const showMechanismOfInjury = !!(mechanismOfInjury && mechanismOfInjury.length > 0);
  const showHpi = !!(hpi && hpi.length > 0);
  const showLegacyReviewOfSystems = !!(rosLegacyText && rosLegacyText.length > 0);
  const showAdditionalQuestions =
    !!(observations && observations.length > 0) || !!(screeningNotes && screeningNotes.length > 0);
  const showAssessment = !!(diagnoses && diagnoses.length > 0);
  const showMedicalDecisionMaking = !!(medicalDecision && medicalDecision.length > 0);
  const showEmCode = !!emCode;
  const showCptCodes = !!(cptCodes && cptCodes.length > 0);
  const showRosReviewContainer = Object.values(rosState).filter((rosObs) => rosObs.value).length > 0;

  const externalLabResultsPending = !!(
    externalLabResults?.resultsPending && externalLabResults?.resultsPending.length > 0
  );
  const externalLabResultsReceived = !!(
    externalLabResults?.labOrderResults && externalLabResults?.labOrderResults.length > 0
  );
  const showExternalLabsResultsContainer = externalLabResultsPending || externalLabResultsReceived;

  const inHouseLabResultsPending = !!(
    inHouseLabResults?.resultsPending && inHouseLabResults?.resultsPending.length > 0
  );
  const inHouseLabResultsEntered = !!(
    inHouseLabResults?.labOrderResults && inHouseLabResults?.labOrderResults.length > 0
  );
  const showInHouseLabsResultsContainer = !!(inHouseLabResultsPending || inHouseLabResultsEntered);

  const showRadiologyContainer = !!(radiologyOrders && radiologyOrders?.length > 0);

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

  const { isAppointmentReadOnly } = useGetAppointmentAccessibility();
  const inlineEditEnabled = FEATURE_FLAGS.INLINE_PROGRESS_NOTE_EDITING_ENABLED && !isAppointmentReadOnly;
  // The supervisor approval box reuses these sections as a read-only summary.
  const inlineEditDisabled = approvalStatus === 'waiting-for-approval';

  const medicalHistorySections = [
    <InlineEditSection
      sectionName="allergies"
      iconKey="Allergies"
      editLabel="Edit allergies"
      editContent={<AllergiesBody />}
      disabled={inlineEditDisabled}
    >
      <AllergiesContainer notes={allergyNotes} />
    </InlineEditSection>,
    <InlineEditSection
      sectionName="medications"
      iconKey="Medications"
      editLabel="Edit medications"
      editContent={<MedicationsBody />}
      disabled={inlineEditDisabled}
    >
      <MedicationsContainer notes={intakeMedicationNotes} />
    </InlineEditSection>,
    <InlineEditSection
      sectionName="medical-conditions"
      iconKey="Medical Conditions"
      editLabel="Edit medical conditions"
      editContent={<MedicalConditionsBody />}
      disabled={inlineEditDisabled}
    >
      <MedicalConditionsContainer notes={medicalConditionNotes} />
    </InlineEditSection>,
    <InlineEditSection
      sectionName="surgical-history"
      iconKey="Surgical History"
      editLabel="Edit surgical history"
      editContent={<SurgicalHistoryBody />}
      disabled={inlineEditDisabled}
    >
      <SurgicalHistoryContainer notes={surgicalHistoryNotes} />
    </InlineEditSection>,
    <InlineEditSection
      sectionName="hospitalization"
      iconKey="Hospitalization"
      editLabel="Edit hospitalization"
      editContent={<HospitalizationBody />}
      disabled={inlineEditDisabled}
    >
      <HospitalizationContainer notes={hospitalizationNotes} />
    </InlineEditSection>,
    (showInHouseMedications || inlineEditEnabled) && (
      <InlineEditSection
        sectionName="in-house-medications"
        iconKey="Med. Administration"
        editLabel="Edit in-house medications"
        editContent={<InHouseMedicationsInlineFlow />}
        disabled={inlineEditDisabled}
      >
        {showInHouseMedications ? (
          <InHouseMedicationsContainer medications={inHouseMedications} notes={inHouseMedicationNotes} />
        ) : (
          <BlankSection title="In-House Medications" message="No in-house medications" />
        )}
      </InlineEditSection>
    ),
    (showImmunization || inlineEditEnabled) && (
      <InlineEditSection
        sectionName="immunizations"
        iconKey="Immunization"
        editLabel="Edit immunizations"
        editContent={<ImmunizationInlineFlow />}
        disabled={inlineEditDisabled}
      >
        {showImmunization ? (
          <ImmunizationContainer orders={immunizationOrders} />
        ) : (
          <BlankSection title="Immunization" message="No immunizations administered" />
        )}
      </InlineEditSection>
    ),
  ].filter(Boolean);

  const sections = [
    displayExamMigrationWarning && !hasIncompatibleExamConfig && (
      <SectionWithIcon>
        <ExamMigrationWarning unmatchedFields={unmatchedExamFields} />
      </SectionWithIcon>
    ),
    (showChiefComplaint || showReasonForVisit || inlineEditEnabled) && (
      <InlineEditSection
        sectionName="chief-complaint"
        iconKey="Chief Complaint"
        editLabel="Edit chief complaint"
        editContent={<ChiefComplaintBody />}
      >
        <ChiefComplaintContainer />
      </InlineEditSection>
    ),
    // HPI and MOI are documented on the same screen and read as one section with a
    // subsection each; MOI only appears for the injury visits that have it.
    (showHpi || showMechanismOfInjury || inlineEditEnabled) && (
      <InlineEditSection
        sectionName="hpi-moi"
        iconKey="History"
        editLabel="Edit HPI/MOI"
        editContent={<HistoryAndTemplatesBody />}
      >
        <HpiMoiContainer />
      </InlineEditSection>
    ),
    showLegacyReviewOfSystems && (
      <SectionWithIcon iconKey="Checklist">
        <ReviewOfSystemsContainer />
      </SectionWithIcon>
    ),
    (showRosReviewContainer || inlineEditEnabled) && (
      <InlineEditSection
        sectionName="review-of-systems"
        iconKey="Checklist"
        editLabel="Edit review of systems"
        editContent={<RosBody />}
      >
        <RosReviewContainer />
      </InlineEditSection>
    ),
    (showAdditionalQuestions || inlineEditEnabled) && (
      <InlineEditSection
        sectionName="screening"
        iconKey="Screening Questions"
        editLabel="Edit screening questions"
        editContent={<ScreeningBody />}
      >
        <AdditionalQuestionsContainer notes={screeningNotes} emptyMessage="No screening information" />
      </InlineEditSection>
    ),
    (showVitalsObservations || inlineEditEnabled) && (
      <InlineEditSection
        sectionName="vitals"
        iconKey="Vitals"
        editLabel="Edit vitals"
        editContent={<PatientVitalsBody />}
      >
        <PatientVitalsContainer notes={vitalsNotes} encounterId={encounter?.id} />
      </InlineEditSection>
    ),

    <InlineEditSection
      sectionName="examination"
      iconKey="Stethoscope"
      editLabel="Edit examination"
      editContent={<ExamBody />}
      disabled={displayExamMigrationWarning && hasIncompatibleExamConfig}
    >
      <Stack spacing={1}>
        <Typography variant="h5" color="primary.dark">
          Examination
        </Typography>
        {/* If the exam version is flagged as incompatible, we cannot run the migration safely.
       If it both needs migration and is incompatible, hide the exam and direct the user to the visit PDF. */}
        {displayExamMigrationWarning && hasIncompatibleExamConfig ? (
          <Typography color="text.secondary">{INCOMPATIBLE_EXAM_VERSION_MESSAGE}</Typography>
        ) : (
          <ExaminationContainer examConfig={examConfigComponents} />
        )}
      </Stack>
    </InlineEditSection>,
    ...(!(approvalStatus === 'waiting-for-approval') ? medicalHistorySections : []),
    // Diagnoses, medical decision making and the billing codes are all documented on the
    // Assessment screen, so they read as subsections of one Assessment section.
    (showAssessment || showMedicalDecisionMaking || showEmCode || showCptCodes || inlineEditEnabled) && (
      <InlineEditSection
        sectionName="assessment"
        iconKey="Prescription"
        editLabel="Edit assessment"
        editContent={<AssessmentBody />}
      >
        <AssessmentGroupContainer />
      </InlineEditSection>
    ),
    (showInHouseLabsResultsContainer || (inlineEditEnabled && FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED)) && (
      <InlineEditSection
        sectionName="in-house-labs"
        iconKey="In-House Labs"
        editLabel="Edit in-house lab orders"
        editContent={<InHouseLabsInlineFlow />}
      >
        {showInHouseLabsResultsContainer ? (
          <LabResultsReviewContainer
            resultDetails={{ type: LabType.inHouse, results: inHouseLabResults.labOrderResults }}
            resultsPending={inHouseLabResultsPending}
          />
        ) : (
          <BlankSection title="In-House Labs" message="No in-house lab orders" />
        )}
      </InlineEditSection>
    ),
    (showExternalLabsResultsContainer || (inlineEditEnabled && FEATURE_FLAGS.LAB_ORDERS_ENABLED)) && (
      <InlineEditSection
        sectionName="external-labs"
        iconKey="External Labs"
        editLabel="Edit external lab orders"
        editContent={<ExternalLabsInlineFlow />}
      >
        {showExternalLabsResultsContainer ? (
          <LabResultsReviewContainer
            resultDetails={{ type: LabType.external, results: externalLabResults.labOrderResults }}
            resultsPending={externalLabResultsPending}
          />
        ) : (
          <BlankSection title="External Labs" message="No external lab orders" />
        )}
      </InlineEditSection>
    ),
    (showRadiologyContainer || (inlineEditEnabled && FEATURE_FLAGS.RADIOLOGY_ENABLED)) && (
      <InlineEditSection
        sectionName="radiology"
        iconKey="Radiology"
        editLabel="Edit radiology orders"
        editContent={<RadiologyInlineFlow />}
      >
        <RadiologyOrdersContainer radiologyOrders={radiologyOrders ?? []} />
      </InlineEditSection>
    ),
    (showProceduresContainer || inlineEditEnabled) && (
      <InlineEditSection
        sectionName="procedures"
        iconKey="Procedures"
        editLabel="Edit procedures"
        editContent={<ProceduresInlineFlow />}
      >
        {showProceduresContainer ? (
          <ProceduresContainer />
        ) : (
          <BlankSection title="Procedures" message="No procedures documented" />
        )}
      </InlineEditSection>
    ),
    // Staff-facing only: nursing orders are shown here for the signing provider but are
    // deliberately left out of the visit note and discharge PDFs.
    <SectionWithIcon iconKey="Nursing Orders">
      <NursingOrdersReviewContainer encounterId={encounter?.id} />
    </SectionWithIcon>,
    (showPrescribedMedications || inlineEditEnabled) && (
      <InlineEditSection
        sectionName="prescriptions"
        iconKey="eRX"
        editLabel="Edit prescriptions"
        editContent={<ERXInlineFlow />}
      >
        {showPrescribedMedications ? (
          <PrescribedMedicationsContainer />
        ) : (
          <BlankSection title="Prescriptions" message="No prescriptions" />
        )}
      </InlineEditSection>
    ),
    (showPatientInstructions || inlineEditEnabled) && (
      <InlineEditSection sectionName="plan" iconKey="Lab profile" editLabel="Edit plan" editContent={<PlanBody />}>
        {showPatientInstructions ? (
          <PatientInstructionsContainer />
        ) : (
          <BlankSection title="Plan" message="No patient instructions" />
        )}
      </InlineEditSection>
    ),
    <SectionWithIcon>
      <PrivacyPolicyAcknowledgement />
    </SectionWithIcon>,
  ].filter(Boolean);

  const handleApprove = async (): Promise<void> => {
    if (!apiClient || !appointment?.id) {
      throw new Error('api client not defined or appointmentId not provided');
    }
    await signAppointment({
      apiClient,
      appointmentId: appointment.id,
      timezone: DateTime.now().zoneName,
      supervisorApprovalEnabled: FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED,
      encounterId: encounter.id!,
    });
    navigate(`/visits?tab=${ApptTab.completed}`);
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
