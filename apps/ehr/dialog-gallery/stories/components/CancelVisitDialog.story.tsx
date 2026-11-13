import CancelVisitDialog from 'src/components/CancelVisitDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Cancel visit',
  source: 'apps/ehr/src/components/CancelVisitDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Telemed appointment → cancel visit',
  // The component reads :id from the URL.
  route: '/telemed/appointments/appt-1',
  routePath: '/telemed/appointments/:id',
  render: () => <CancelVisitDialog onClose={() => undefined} />,
});
