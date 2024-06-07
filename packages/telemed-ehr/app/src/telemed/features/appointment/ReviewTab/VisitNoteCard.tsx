import React, { FC } from 'react';
import { Box, Divider } from '@mui/material';
import { AccordionCard } from '../../../components';
import {
  PatientInformationContainer,
  VisitDetailsContainer,
  ChiefComplaintContainer,
  ReviewOfSystemsContainer,
  MedicationsContainer,
  AllergiesContainer,
  MedicalConditionsContainer,
  SurgicalHistoryContainer,
  AdditionalQuestionsContainer,
  ExaminationContainer,
  AssessmentContainer,
  MedicalDecisionMakingContainer,
  CptCodeContainer,
  PrescriptionsContainer,
  PatientInstructionsContainer,
} from './components';

export const VisitNoteCard: FC = () => {
  return (
    <AccordionCard label="Visit note">
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'start' }}>
        <PatientInformationContainer />
        <Divider orientation="horizontal" flexItem />
        <VisitDetailsContainer />
        <Divider orientation="horizontal" flexItem />
        <ChiefComplaintContainer />
        <Divider orientation="horizontal" flexItem />
        <ReviewOfSystemsContainer />
        <Divider orientation="horizontal" flexItem />
        <MedicationsContainer />
        <Divider orientation="horizontal" flexItem />
        <AllergiesContainer />
        <Divider orientation="horizontal" flexItem />
        <MedicalConditionsContainer />
        <Divider orientation="horizontal" flexItem />
        <SurgicalHistoryContainer />
        <Divider orientation="horizontal" flexItem />
        <AdditionalQuestionsContainer />
        <Divider orientation="horizontal" flexItem />
        <ExaminationContainer />
        <Divider orientation="horizontal" flexItem />
        <AssessmentContainer />
        <Divider orientation="horizontal" flexItem />
        <MedicalDecisionMakingContainer />
        <Divider orientation="horizontal" flexItem />
        <CptCodeContainer />
        <Divider orientation="horizontal" flexItem />
        <PrescriptionsContainer />
        <Divider orientation="horizontal" flexItem />
        <PatientInstructionsContainer />
      </Box>
    </AccordionCard>
  );
};
