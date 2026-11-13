import { InPersonModal } from 'src/features/visits/in-person/components/InPersonModal';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'InPersonModal (base, default props)',
  source: 'apps/ehr/src/features/visits/in-person/components/InPersonModal.tsx',
  base: 'CustomDialog',
  kind: 'confirm',
  where: 'Shared wrapper around CustomDialog used across in-person visit screens (delete note, delete vital, ...)',
  render: () => (
    <InPersonModal
      open
      handleClose={() => undefined}
      handleConfirm={() => undefined}
      title="Dialog title"
      description="Body text passed as a plain string description."
      closeButtonText="Cancel"
      confirmText="Confirm"
    />
  ),
  notes: 'Default props: warning icon, error-coloured title, no entity preview (no entity passed).',
});
