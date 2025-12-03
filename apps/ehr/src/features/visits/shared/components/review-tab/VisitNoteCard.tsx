import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { PatientVitalsContainer } from 'src/features/visits/in-person/components/progress-note/PatientVitalsContainer';
import { examConfig, getSpentTime, patientScreeningQuestionsConfig, vitalsObservationsRequest } from 'utils';
import { AccordionCard } from '../../../../../components/AccordionCard';
import { useChartFields } from '../../hooks/useChartFields';
import { usePatientInstructionsVisibility } from '../../hooks/usePatientInstructionsVisibility';
import { useAppointmentData, useChartData } from '../../stores/appointment/appointment.store';
import { SectionList } from '../SectionList';
import { AdditionalQuestionsContainer } from './components/AdditionalQuestionsContainer';
import { AllergiesContainer } from './components/AllergiesContainer';
import { AssessmentContainer } from './components/AssessmentContainer';
import { CPTCodesContainer } from './components/CPTCodesContainer';
import { EMCodeContainer } from './components/EMCodeContainer';
import { ExaminationContainer } from './components/ExaminationContainer';
import { HistoryOfPresentIllnessContainer } from './components/HistoryOfPresentIllnessContainer';
import { MedicalConditionsContainer } from './components/MedicalConditionsContainer';
import { MedicalDecisionMakingContainer } from './components/MedicalDecisionMakingContainer';
import { MedicationsContainer } from './components/MedicationsContainer';
import { PatientInformationContainer } from './components/PatientInformationContainer';
import { PatientInstructionsContainer } from './components/PatientInstructionsContainer';
import { PrescribedMedicationsContainer } from './components/PrescribedMedicationsContainer';
import { PrivacyPolicyAcknowledgement } from './components/PrivacyPolicyAcknowledgement';
import { ReviewOfSystemsContainer } from './components/ReviewOfSystemsContainer';
import { SurgicalHistoryContainer } from './components/SurgicalHistoryContainer';
import { VisitDetailsContainer } from './components/VisitDetailsContainer';

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
      vitalsObservations: vitalsObservationsRequest,
    },
  });

  const { chartData } = useChartData();
  const hpi = chartFields?.chiefComplaint?.text;
  const spentTime = getSpentTime(encounter.statusHistory);
  const ros = chartFields?.ros?.text;
  const diagnoses = chartData?.diagnosis;
  const medicalDecision = chartFields?.medicalDecision?.text;
  const emCode = chartData?.emCode;
  const cptCodes = chartData?.cptCodes;
  const prescriptions = chartFields?.prescribedMedications;
  const showHistoryOfPresentIllness = !!((hpi && hpi.length > 0) || (spentTime && spentTime.length > 0));
  const showReviewOfSystems = !!(ros && ros.length > 0);
  const vitalsObservations = chartFields?.vitalsObservations;

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
  const showVitalsObservations = !!(vitalsObservations && vitalsObservations.length > 0);

  const sections = [
    <PatientInformationContainer />,
    <VisitDetailsContainer />,
    showHistoryOfPresentIllness && <HistoryOfPresentIllnessContainer />,
    showReviewOfSystems && <ReviewOfSystemsContainer />,
    showVitalsObservations && <PatientVitalsContainer encounterId={encounter?.id} />,
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
