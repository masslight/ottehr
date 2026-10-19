import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { ImmunizationContainer } from 'src/features/visits/in-person/components/ImmunizationContainer';
import { LabResultsReviewContainer } from 'src/features/visits/in-person/components/LabResultsReviewContainer';
import { AllergiesContainer } from 'src/features/visits/shared/components/review-tab/components/AllergiesContainer';
import { MedicalConditionsContainer } from 'src/features/visits/shared/components/review-tab/components/MedicalConditionsContainer';
import { MedicationsContainer } from 'src/features/visits/shared/components/review-tab/components/MedicationsContainer';
import { PatientInstructionsContainer } from 'src/features/visits/shared/components/review-tab/components/PatientInstructionsContainer';
import { PrescribedMedicationsContainer } from 'src/features/visits/shared/components/review-tab/components/PrescribedMedicationsContainer';
import { ProceduresContainer } from 'src/features/visits/shared/components/review-tab/components/ProceduresContainer';
import { SurgicalHistoryContainer } from 'src/features/visits/shared/components/review-tab/components/SurgicalHistoryContainer';
import { SectionList } from 'src/features/visits/shared/components/SectionList';
import { usePatientInstructionsVisibility } from 'src/features/visits/shared/hooks/usePatientInstructionsVisibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { LabType } from 'utils/lib/types/data/labs/labs.types';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { useVisitNote } from '../../../shared/hooks/useVisitNote';
import { useGetImmunizationOrders } from '../../hooks/useImmunization';
import { useMedicationAPI } from '../../hooks/useMedicationOperations';
import { HospitalizationContainer } from '../progress-note/HospitalizationContainer';
import { InHouseMedicationsContainer } from '../progress-note/InHouseMedicationsContainer';

export const FollowUpNoteDetails: FC = () => {
  const { encounter } = useAppointmentData();
  const { data: note } = useVisitNote();
  const { medications: inHouseMedications } = useMedicationAPI();

  const { data: immunizationOrdersResponse } = useGetImmunizationOrders({
    encounterIds: [encounter.id!],
  });

  const immunizationOrders = (immunizationOrdersResponse?.orders ?? []).filter((order) =>
    ['administered', 'administered-partly'].includes(order.status)
  );

  // Filter notes by type
  const allergyNotes = note?.notes.notes?.filter((note) => note.type === NOTE_TYPE.ALLERGY);
  const intakeMedicationNotes = note?.notes.notes?.filter((note) => note.type === NOTE_TYPE.INTAKE_MEDICATION);
  const hospitalizationNotes = note?.notes.notes?.filter((note) => note.type === NOTE_TYPE.HOSPITALIZATION);
  const medicalConditionNotes = note?.notes.notes?.filter((note) => note.type === NOTE_TYPE.MEDICAL_CONDITION);
  const surgicalHistoryNotes = note?.notes.notes?.filter((note) => note.type === NOTE_TYPE.SURGICAL_HISTORY);
  const inHouseMedicationNotes = note?.notes.notes?.filter((note) => note.type === NOTE_TYPE.MEDICATION);

  // Get data from chart fields
  const prescriptions = note?.plan.prescribedMedications;
  const externalLabResults = note?.externalLabResults;
  const inHouseLabResults = note?.inHouseLabResults;

  // Show conditions
  const showInHouseMedications =
    !!(inHouseMedications && inHouseMedications.length > 0) ||
    !!(inHouseMedicationNotes && inHouseMedicationNotes.length > 0);
  const showImmunization = immunizationOrders.length > 0;

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

  const showProceduresContainer = (note?.assessment.procedures?.length ?? 0) > 0;
  const showPrescribedMedications = !!(prescriptions && prescriptions.length > 0);

  const { showPatientInstructions } = usePatientInstructionsVisibility();

  const sections = [
    <AllergiesContainer notes={allergyNotes} />,
    <MedicationsContainer notes={intakeMedicationNotes} />,
    <MedicalConditionsContainer notes={medicalConditionNotes} />,
    <SurgicalHistoryContainer notes={surgicalHistoryNotes} />,
    <HospitalizationContainer notes={hospitalizationNotes} />,
    showPrescribedMedications && <PrescribedMedicationsContainer />,
    showInHouseMedications && (
      <InHouseMedicationsContainer medications={inHouseMedications} notes={inHouseMedicationNotes} />
    ),
    showImmunization && <ImmunizationContainer orders={immunizationOrders} />,
    showExternalLabsResultsContainer && (
      <LabResultsReviewContainer
        resultDetails={{ type: LabType.external, results: externalLabResults.labOrderResults }}
        resultsPending={externalLabResultsPending}
      />
    ),
    showInHouseLabsResultsContainer && (
      <LabResultsReviewContainer
        resultDetails={{ type: LabType.inHouse, results: inHouseLabResults.labOrderResults }}
        resultsPending={inHouseLabResultsPending}
      />
    ),
    showProceduresContainer && <ProceduresContainer />,
    showPatientInstructions && <PatientInstructionsContainer />,
  ].filter(Boolean);

  return (
    <AccordionCard label="Follow-up Note" dataTestId={dataTestIds.progressNotePage.visitNoteCard}>
      <SectionList sections={sections} sx={{ p: 2 }} />
    </AccordionCard>
  );
};
