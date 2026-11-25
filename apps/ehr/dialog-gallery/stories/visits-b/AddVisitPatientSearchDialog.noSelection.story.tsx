import { ReactElement, useState } from 'react';
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

// Holds the selection the way the Add Visit page does, so the radio and the "Prefill for" button agree.
const Host = (): ReactElement => {
  const [selectedPatient, setSelectedPatient] = useState<AddVisitPatientInfo | undefined>();
  return (
    <AddVisitPatientSearchDialog
      openSearchResults
      setOpenSearchResults={() => undefined}
      selectedPatient={selectedPatient}
      setSelectedPatient={setSelectedPatient}
      patients={patients}
      handleSelectExistingPatient={() => undefined}
      handleManuallyEnterPatientDetails={() => undefined}
    />
  );
};

export default defineStory({
  title: 'Add visit: select existing patient (nothing selected yet)',
  source: 'apps/ehr/src/features/visits/shared/components/staff-add-visit/AddVisitPatientSearchDialog.tsx',
  base: 'MUI Dialog',
  kind: 'picker',
  where: 'Add visit → search for patient → results',
  notes: 'As the dialog first opens: no patient picked, so the conditional "Prefill for …" button is absent.',
  render: () => <Host />,
  play: async ({ screen }) => {
    await screen.findAllByRole('radio');
  },
});
