import React, { FC } from 'react';
import { AccordionCard, SectionList, useAppointmentStore, usePatientInstructionsVisibility } from '../../../../telemed';
import { Stack, Typography } from '@mui/material';
import {
  AdditionalQuestionsContainer,
  AllergiesContainer,
  AssessmentContainer,
  ChiefComplaintContainer,
  CPTCodesContainer,
  EMCodeContainer,
  MedicalConditionsContainer,
  MedicalDecisionMakingContainer,
  MedicationsContainer,
  PatientInstructionsContainer,
  PrescribedMedicationsContainer,
  PrivacyPolicyAcknowledgement,
  ReviewOfSystemsContainer,
  SurgicalHistoryContainer,
  LabResultsReviewContainer,
} from '../../../../telemed/features/appointment/ReviewTab';
import { ExamReadOnlyBlock } from '../examination/ExamReadOnly';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useChartData } from '../../hooks/useChartData';
import { HospitalizationContainer } from './HospitalizationContainer';
import { NOTE_TYPE, getProgressNoteChartDataRequestedFields } from 'utils';
import { PatientVitalsContainer } from './PatientVitalsContainer';

export const ProgressNoteDetails: FC = () => {
  const { chartData, encounter, setPartialChartData } = getSelectors(useAppointmentStore, [
    'chartData',
    'encounter',
    'setPartialChartData',
  ]);

  const { chartData: additionalChartData } = useChartData({
    encounterId: encounter.id || '',
    requestedFields: getProgressNoteChartDataRequestedFields(),
    onSuccess: (data) => {
      setPartialChartData({
        episodeOfCare: data?.episodeOfCare,
        vitalsObservations: data?.vitalsObservations,
        prescribedMedications: data?.prescribedMedications,
        labResults: data?.labResults,
      });
    },
  });

  const screeningNotes = additionalChartData?.notes?.filter((note) => note.type === NOTE_TYPE.SCREENING);
  const vitalsNotes = additionalChartData?.notes?.filter((note) => note.type === NOTE_TYPE.VITALS);

  const chiefComplaint = chartData?.chiefComplaint?.text;
  const ros = chartData?.ros?.text;
  const diagnoses = chartData?.diagnosis;
  const medicalDecision = chartData?.medicalDecision?.text;
  const emCode = chartData?.emCode;
  const cptCodes = chartData?.cptCodes;
  const prescriptions = chartData?.prescribedMedications;
  const observations = chartData?.observations;
  const vitalsObservations = chartData?.vitalsObservations;

  const showChiefComplaint = !!(chiefComplaint && chiefComplaint.length > 0);
  const showReviewOfSystems = !!(ros && ros.length > 0);
  const showAdditionalQuestions =
    !!(observations && observations.length > 0) || !!(screeningNotes && screeningNotes.length > 0);
  const showAssessment = !!(diagnoses && diagnoses.length > 0);
  const showMedicalDecisionMaking = !!(medicalDecision && medicalDecision.length > 0);
  const showEmCode = !!emCode;
  const showCptCodes = !!(cptCodes && cptCodes.length > 0);
  const showPrescribedMedications = !!(prescriptions && prescriptions.length > 0);
  const { showPatientInstructions } = usePatientInstructionsVisibility();

  const showVitalsObservations =
    !!(vitalsObservations && vitalsObservations.length > 0) || !!(vitalsNotes && vitalsNotes.length > 0);

  const sections = [
    showChiefComplaint && <ChiefComplaintContainer />,
    showReviewOfSystems && <ReviewOfSystemsContainer />,
    showAdditionalQuestions && <AdditionalQuestionsContainer notes={screeningNotes} />,
    showVitalsObservations && <PatientVitalsContainer notes={vitalsNotes} />,
    <Stack spacing={1}>
      <Typography variant="h5" color="primary.dark">
        Examination
      </Typography>
      <ExamReadOnlyBlock />
    </Stack>,
    <AllergiesContainer />,
    <MedicationsContainer />,
    <MedicalConditionsContainer />,
    <SurgicalHistoryContainer />,
    <HospitalizationContainer />,
    showAssessment && <AssessmentContainer />,
    showMedicalDecisionMaking && <MedicalDecisionMakingContainer />,
    showEmCode && <EMCodeContainer />,
    showCptCodes && <CPTCodesContainer />,
    <LabResultsReviewContainer />,
    showPrescribedMedications && <PrescribedMedicationsContainer />,
    showPatientInstructions && <PatientInstructionsContainer />,
    <PrivacyPolicyAcknowledgement />,
  ].filter(Boolean);

  return (
    <AccordionCard label="Objective">
      <SectionList sections={sections} sx={{ p: 2 }} />
    </AccordionCard>
  );
};
