import { FC } from 'react';
import { getSpentTime, telemedProgressNoteChartDataRequestedFields } from 'utils';
import { AccordionCard, SectionList } from '../../../components';
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
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';
import { ADDITIONAL_QUESTIONS } from '../../../../constants';
import { usePatientInstructionsVisibility } from '../../../hooks';
import { useChartData } from '../../../../features/css-module/hooks/useChartData';

export const VisitNoteCard: FC = () => {
  const { chartData, encounter, setPartialChartData } = getSelectors(useAppointmentStore, [
    'chartData',
    'encounter',
    'setPartialChartData',
  ]);

  useChartData({
    encounterId: encounter.id || '',
    requestedFields: telemedProgressNoteChartDataRequestedFields,
    onSuccess: (data) => {
      setPartialChartData({ prescribedMedications: data.prescribedMedications });
    },
  });

  const chiefComplaint = chartData?.chiefComplaint?.text;
  const spentTime = getSpentTime(encounter.statusHistory);
  const ros = chartData?.ros?.text;
  const medications = chartData?.medications;
  const allergies = chartData?.allergies;
  const conditions = chartData?.conditions;
  const procedures = chartData?.procedures;
  const proceduresNote = chartData?.proceduresNote?.text;
  const diagnoses = chartData?.diagnosis;
  const medicalDecision = chartData?.medicalDecision?.text;
  const emCode = chartData?.emCode;
  const cptCodes = chartData?.cptCodes;
  const prescriptions = chartData?.prescribedMedications;

  const showChiefComplaint = !!((chiefComplaint && chiefComplaint.length > 0) || (spentTime && spentTime.length > 0));
  const showReviewOfSystems = !!(ros && ros.length > 0);
  const showMedications = !!(medications && medications.length > 0);
  const showAllergies = !!(allergies && allergies.length > 0);
  const showMedicalConditions = !!(conditions && conditions.length > 0);
  const showSurgicalHistory = !!(
    (procedures && procedures.length > 0) ||
    (proceduresNote && proceduresNote.length > 0)
  );
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
    showMedications && <MedicationsContainer />,
    showAllergies && <AllergiesContainer />,
    showMedicalConditions && <MedicalConditionsContainer />,
    showSurgicalHistory && <SurgicalHistoryContainer />,
    showAdditionalQuestions && <AdditionalQuestionsContainer />,
    <ExaminationContainer />,
    showAssessment && <AssessmentContainer />,
    showMedicalDecisionMaking && <MedicalDecisionMakingContainer />,
    showEmCode && <EMCodeContainer />,
    showCptCodes && <CPTCodesContainer />,
    showPrescribedMedications && <PrescribedMedicationsContainer />,
    showPatientInstructions && <PatientInstructionsContainer />,
    <PrivacyPolicyAcknowledgement />,
  ].filter(Boolean);

  return (
    <AccordionCard label="Visit note">
      <SectionList sections={sections} sx={{ p: 2 }} />
    </AccordionCard>
  );
};
