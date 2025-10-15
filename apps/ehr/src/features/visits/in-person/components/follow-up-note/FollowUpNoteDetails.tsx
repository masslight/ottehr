import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { ImmunizationContainer } from 'src/features/visits/in-person/components/ImmunizationContainer';
import { LabResultsReviewContainer } from 'src/features/visits/in-person/components/LabResultsReviewContainer';
import { AllergiesContainer } from 'src/features/visits/shared/components/review-tab/components/AllergiesContainer';
import { MedicalConditionsContainer } from 'src/features/visits/shared/components/review-tab/components/MedicalConditionsContainer';
import { MedicationsContainer } from 'src/features/visits/shared/components/review-tab/components/MedicationsContainer';
import { PrescribedMedicationsContainer } from 'src/features/visits/shared/components/review-tab/components/PrescribedMedicationsContainer';
import { ProceduresContainer } from 'src/features/visits/shared/components/review-tab/components/ProceduresContainer';
import { SurgicalHistoryContainer } from 'src/features/visits/shared/components/review-tab/components/SurgicalHistoryContainer';
import { SectionList } from 'src/features/visits/shared/components/SectionList';
import { useChartFields } from 'src/features/visits/shared/hooks/useChartFields';
import { useAppointmentData, useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { LabType, NOTE_TYPE, progressNoteChartDataRequestedFields } from 'utils';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { useGetImmunizationOrders } from '../../hooks/useImmunization';
import { useMedicationAPI } from '../../hooks/useMedicationOperations';
import { HospitalizationContainer } from '../progress-note/HospitalizationContainer';
import { InHouseMedicationsContainer } from '../progress-note/InHouseMedicationsContainer';

export const FollowUpNoteDetails: FC = () => {
  const { encounter } = useAppointmentData();
  const { data: chartFields } = useChartFields({ requestedFields: progressNoteChartDataRequestedFields });
  const { chartData } = useChartData();
  const { medications: inHouseMedicationsWithCanceled } = useMedicationAPI();
  const inHouseMedications = inHouseMedicationsWithCanceled.filter((medication) => medication.status !== 'cancelled');

  const { data: immunizationOrdersResponse } = useGetImmunizationOrders({
    encounterId: encounter.id,
  });

  const immunizationOrders = (immunizationOrdersResponse?.orders ?? []).filter((order) =>
    ['administered', 'administered-partly'].includes(order.status)
  );

  // Filter notes by type
  const allergyNotes = chartFields?.notes?.filter((note) => note.type === NOTE_TYPE.ALLERGY);
  const intakeMedicationNotes = chartFields?.notes?.filter((note) => note.type === NOTE_TYPE.INTAKE_MEDICATION);
  const hospitalizationNotes = chartFields?.notes?.filter((note) => note.type === NOTE_TYPE.HOSPITALIZATION);
  const medicalConditionNotes = chartFields?.notes?.filter((note) => note.type === NOTE_TYPE.MEDICAL_CONDITION);
  const surgicalHistoryNotes = chartFields?.notes?.filter((note) => note.type === NOTE_TYPE.SURGICAL_HISTORY);
  const inHouseMedicationNotes = chartFields?.notes?.filter((note) => note.type === NOTE_TYPE.MEDICATION);

  // Get data from chart fields
  const prescriptions = chartFields?.prescribedMedications;
  const externalLabResults = chartFields?.externalLabResults;
  const inHouseLabResults = chartFields?.inHouseLabResults;

  // Show conditions
  const showInHouseMedications =
    !!(inHouseMedications && inHouseMedications.length > 0) ||
    !!(inHouseMedicationNotes && inHouseMedicationNotes.length > 0);
  const showImmunization = immunizationOrders.length > 0;
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
        resultsPending={externalLabResults.resultsPending}
      />
    ),
    showInHouseLabsResultsContainer && (
      <LabResultsReviewContainer
        resultDetails={{ type: LabType.inHouse, results: inHouseLabResults.labOrderResults }}
        resultsPending={inHouseLabResults.resultsPending}
      />
    ),
    showProceduresContainer && <ProceduresContainer />,
  ].filter(Boolean);

  return (
    <AccordionCard label="Follow-up Note" dataTestId={dataTestIds.progressNotePage.visitNoteCard}>
      <SectionList sections={sections} sx={{ p: 2 }} />
    </AccordionCard>
  );
};
