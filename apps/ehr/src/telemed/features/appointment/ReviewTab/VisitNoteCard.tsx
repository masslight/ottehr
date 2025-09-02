import { FC } from 'react';
import { examConfig, getSpentTime } from 'utils';
import { ADDITIONAL_QUESTIONS } from '../../../../constants';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { AccordionCard, SectionList } from '../../../components';
import { usePatientInstructionsVisibility } from '../../../hooks';
import { useAppointmentData, useChartData } from '../../../state';
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
  const { chartData } = useChartData();
  const chiefComplaint = chartData?.chiefComplaint?.text;
  const spentTime = getSpentTime(encounter.statusHistory);
  const ros = chartData?.ros?.text;
  const diagnoses = chartData?.diagnosis;
  const medicalDecision = chartData?.medicalDecision?.text;
  const emCode = chartData?.emCode;
  const cptCodes = chartData?.cptCodes;
  const prescriptions = chartData?.prescribedMedications;
  const showChiefComplaint = !!((chiefComplaint && chiefComplaint.length > 0) || (spentTime && spentTime.length > 0));
  const showReviewOfSystems = !!(ros && ros.length > 0);

  const showAdditionalQuestions = ADDITIONAL_QUESTIONS.some((question) => {
    const value = chartData?.observations?.find((observation) => observation.field === question.field)?.value;
    return value === true || value === false;
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
