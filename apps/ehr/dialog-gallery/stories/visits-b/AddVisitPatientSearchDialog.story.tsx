import { AddVisitPatientSearchDialog } from 'src/features/visits/shared/components/staff-add-visit/AddVisitPatientSearchDialog';
import type { AddVisitPatientInfo } from 'src/pages/AddPatient';
import { defineStory } from '../../harness/story';

const patients = [
  { id: 'pat-1', newPatient: false, firstName: 'Lucas', lastName: 'Alvarez', dateOfBirth: '2017-07-22' },
  {
    id: 'pat-2',
    newPatient: false,
    firstName: 'Lucas',
    middleName: 'James',
    lastName: 'Alvarez',
    dateOfBirth: '1989-02-03',
  },
  { id: 'pat-3', newPatient: false, firstName: 'Lucia', lastName: 'Alvarez', dateOfBirth: '2001-11-30' },
] as unknown as AddVisitPatientInfo[];

export default defineStory({
  title: 'Add visit: select existing patient',
  source: 'apps/ehr/src/features/visits/shared/components/staff-add-visit/AddVisitPatientSearchDialog.tsx',
  base: 'MUI Dialog',
  kind: 'picker',
  where: 'Add visit → search for patient → results',
  notes: 'Rendered with the first result selected so the conditional "Prefill for …" button is visible.',
  render: () => (
    <AddVisitPatientSearchDialog
      openSearchResults
      setOpenSearchResults={() => undefined}
      selectedPatient={patients[0]}
      setSelectedPatient={() => undefined}
      patients={patients}
      handleSelectExistingPatient={() => undefined}
      handleManuallyEnterPatientDetails={() => undefined}
    />
  ),
});
