import { FaxSendResultDialog } from 'src/features/fax/ui/FaxSendResultDialog';
import { FaxRecipientResult } from 'utils/lib/types/api/fax.types';
import { defineStory } from '../../harness/story';

const failures: FaxRecipientResult[] = [
  { name: 'Dr. Maria Alvarez', organization: 'Riverside Family Medicine', faxNumber: '+15185550144', status: 'failed' },
  { faxNumber: '+12125550199', status: 'failed' },
];

export default defineStory({
  title: 'Fax send result: some recipients failed',
  source: 'apps/ehr/src/features/fax/ui/FaxSendResultDialog.tsx',
  base: 'MUI Dialog',
  kind: 'info',
  where: 'After sending a fax packet, when at least one recipient could not be reached',
  render: () => <FaxSendResultDialog failures={failures} onClose={() => undefined} />,
});
