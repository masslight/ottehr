import { FC } from 'react';
import { examConfig, getSpentTime, patientScreeningQuestionsConfig } from 'utils';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { AccordionCard, SectionList } from '../../../components';
import { usePatientInstructionsVisibility } from '../../../hooks';
import { useAppointmentData, useChartData, useChartFields } from '../../../state';
import {
  AdditionalQuestionsContainer,
  AllergiesContainer,
  AssessmentContainer,
  ChiefComplaintContainer,
  CPTCodesContainer,
  EMCodeContainer,
  ExaminationContainer,
  MedicalConditionsContainer,
  MedicalDecisionMakingContainer,
  MedicationsContainer,
  PatientInformationContainer,
  PatientInstructionsContainer,
  PrescribedMedicationsContainer,
  PrivacyPolicyAcknowledgement,
  ReviewOfSystemsContainer,
  SurgicalHistoryContainer,
  VisitDetailsContainer,
} from './components';

export const VisitNoteCard: FC = () => {
  const { encounter } = useAppointmentData();

  const { data: chartFields } = useChartFields({
    requestedFields: {
      prescribedMedications: {},
      medicalDecision: {
        _tag: 'medical-decision',
      },
      chiefComplaint: { _tag: 'chief-complaint' },
      ros: { _tag: 'ros' },
    },
  });

  const { chartData } = useChartData();
  const chiefComplaint = chartFields?.chiefComplaint?.text;
  const spentTime = getSpentTime(encounter.statusHistory);
  const ros = chartFields?.ros?.text;
  const diagnoses = chartData?.diagnosis;
  const medicalDecision = chartFields?.medicalDecision?.text;
  const emCode = chartData?.emCode;
  const cptCodes = chartData?.cptCodes;
  const prescriptions = chartFields?.prescribedMedications;
  const showChiefComplaint = !!((chiefComplaint && chiefComplaint.length > 0) || (spentTime && spentTime.length > 0));
  const showReviewOfSystems = !!(ros && ros.length > 0);

  const showAdditionalQuestions = patientScreeningQuestionsConfig.fields.some((field) => {
    const observation = chartData?.observations?.find((obs) => obs.field === field.fhirField);
    return observation?.value !== undefined && observation?.value !== null;
  });

  const showAssessment = !!(diagnoses && diagnoses.length > 0);
  const showMedicalDecisionMaking = !!(medicalDecision && medicalDecision.length > 0);
  const showEmCode = !!emCode;
  const showCptCodes = !!(cptCodes && cptCodes.length > 0);
  const showPrescribedMedications = !!(prescriptions && prescriptions.length > 0);
  const { showPatientInstructions } = usePatientInstructionsVisibility();

  const sections = [
    <PatientInformationContainer />,
    <VisitDetailsContainer />,
    showChiefComplaint && <ChiefComplaintContainer />,
    showReviewOfSystems && <ReviewOfSystemsContainer />,
    <MedicationsContainer />,
    <AllergiesContainer />,
    <MedicalConditionsContainer />,
    <SurgicalHistoryContainer />,
    showAdditionalQuestions && <AdditionalQuestionsContainer />,
    <ExaminationContainer examConfig={examConfig.telemed.default.components} />,
    showAssessment && <AssessmentContainer />,
    showMedicalDecisionMaking && <MedicalDecisionMakingContainer />,
    showEmCode && <EMCodeContainer />,
    showCptCodes && <CPTCodesContainer />,
    showPrescribedMedications && <PrescribedMedicationsContainer />,
    showPatientInstructions && <PatientInstructionsContainer />,
    <PrivacyPolicyAcknowledgement />,
  ].filter(Boolean);

  return (
    <AccordionCard label="Visit note" dataTestId={dataTestIds.progressNotePage.visitNoteCard}>
      <SectionList sections={sections} sx={{ p: 2 }} />
    </AccordionCard>
  );
};
