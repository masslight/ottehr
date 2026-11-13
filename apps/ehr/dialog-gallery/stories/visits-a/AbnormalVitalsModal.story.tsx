import { Button } from '@mui/material';
import { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { AbnormalVitalsModal } from 'src/features/visits/shared/components/vitals/AbnormalVitalsModal';
import { defineStory } from '../../harness/story';
import { visitRoute } from './_fixtures';
import { abnormalVitals } from './_vitals';

// The modal opens when the user tries to navigate away, so the host offers a navigation.
function Host(): ReactElement {
  const navigate = useNavigate();
  return (
    <>
      <Button onClick={() => navigate('../allergies')}>leave page</Button>
      <AbnormalVitalsModal abnormalVitalsValues={abnormalVitals} />
    </>
  );
}

export default defineStory({
  title: 'Critical & abnormal vital values (leave-page warning)',
  source: 'apps/ehr/src/features/visits/shared/components/vitals/AbnormalVitalsModal.tsx',
  base: 'InPersonModal',
  kind: 'confirm',
  where: 'In-person visit → Vitals page with abnormal values → navigate to another page',
  ...visitRoute,
  render: () => <Host />,
  play: async ({ user, screen }) => {
    await user.click(screen.getByRole('button', { name: 'leave page' }));
  },
  notes:
    'Not in the original file list (InPersonModal via useReactNavigationBlocker). Opened by a real router navigation from a host button; three mocked abnormal/critical vitals.',
});
