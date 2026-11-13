import { ReactElement, useEffect } from 'react';
import { useSendFax } from 'src/features/fax/hooks/useSendFax';
import { SendFaxDialog } from 'src/features/fax/ui/SendFaxDialog';
import { GetFaxPacketPreviewOutput } from 'utils/lib/types/api/fax.types';
import { defineStory } from '../../harness/story';
import { addressBookMocks } from './_addressBook';

const appointmentId = '7c3b1c0e-52f6-4a0b-9d5e-2f4b8a6d9e10';

const preview: GetFaxPacketPreviewOutput = {
  documents: [
    { kind: 'progress-note', available: true, count: 1 },
    { kind: 'discharge-summary', available: true, count: 1 },
    { kind: 'lab-results', available: true, count: 2 },
    { kind: 'radiology-results', available: false },
    { kind: 'patient-education', available: false },
  ],
  pcp: {
    name: 'Maria Alvarez',
    credential: 'MD',
    organization: 'Riverside Family Medicine',
    faxNumber: '5185550144',
    phoneNumber: '5185550143',
  } as GetFaxPacketPreviewOutput['pcp'],
  hasSavedPcp: true,
  senderFaxNumber: '+12125550100',
};

// Same wiring as the in-person visit Header: the real controller hook feeds the dialog.
const Host = (): ReactElement => {
  const controller = useSendFax({ type: 'visit', appointmentId });
  const { open } = controller;
  useEffect(() => open(), [open]);
  return <SendFaxDialog controller={controller} />;
};

export default defineStory({
  title: 'Send fax (visit documents)',
  source: 'apps/ehr/src/features/fax/ui/SendFaxDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where:
    'In-person visit header → "Fax"; also patient page ("Fax Medical Record") and patient documents ("Fax Document")',
  mocks: [{ url: 'fax-packet-preview', response: { status: 200, output: preview } }, ...addressBookMocks],
  render: () => <Host />,
  play: async ({ screen }) => {
    await screen.findByText('Recipient Information', undefined, { timeout: 8000 });
  },
  notes:
    'Driven by the real useSendFax controller (opened programmatically instead of from the visit header button); preview zambda mocked with a PCP on file, so the first recipient is prefilled.',
});
