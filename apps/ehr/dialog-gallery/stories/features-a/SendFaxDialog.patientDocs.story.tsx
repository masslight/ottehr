import { ReactElement, useEffect } from 'react';
import { useSendFax } from 'src/features/fax/hooks/useSendFax';
import { FaxVisitOption } from 'src/features/fax/model/types';
import { SendFaxDialog } from 'src/features/fax/ui/SendFaxDialog';
import { defineStory } from '../../harness/story';
import { addressBookMocks } from './_addressBook';

const patientId = '4f0c2f5e-8d0a-4f3b-9a56-0d6c1f7f2a11';

const visits: FaxVisitOption[] = [
  { appointmentId: '7c3b1c0e-52f6-4a0b-9d5e-2f4b8a6d9e10', label: '10/14/2026 · In-person · Sore throat' },
  { appointmentId: '1a9d4f27-3c1b-4e75-8a40-6b2f0c9e5d21', label: '08/02/2026 · In-person · Ankle sprain' },
  { appointmentId: '9e2b7a63-0f4d-4c18-b7d2-3a5e8f1c6b32', label: '03/19/2026 · Telemed · Seasonal allergies' },
];

// Same wiring as PatientPage: a multi-visit source has no document preview, and the user picks the visits.
const Host = (): ReactElement => {
  const controller = useSendFax({
    type: 'visits',
    patientId,
    appointmentIds: visits.map((visit) => visit.appointmentId),
  });
  const { open } = controller;
  useEffect(() => open(), [open]);
  return <SendFaxDialog controller={controller} title="Fax Patient Docs" visits={visits} />;
};

export default defineStory({
  title: 'Send fax (patient docs: caller title + visit picker)',
  source: 'apps/ehr/src/features/fax/ui/SendFaxDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Patient page → "Fax" → "Patient Docs"',
  mocks: [...addressBookMocks],
  render: () => <Host />,
  play: async ({ screen }) => {
    await screen.findByText('Recipient Information', undefined, { timeout: 8000 });
  },
  notes:
    'Driven by the real useSendFax controller with a multi-visit source; the title and the visit list are passed by the caller, as PatientPage does.',
});
