import { defineStory } from '../../harness/story';
import { renderMobileRow } from './_mobileRow';
import { userMocks } from './_shared';

export default defineStory({
  title: 'Reason for visit (mobile tracking board)',
  source: 'apps/ehr/src/components/ReasonForVisit.tsx',
  base: 'MUI Modal',
  kind: 'info',
  where: 'Tracking board on a phone-width screen → tap a flagged or truncated reason for visit',
  mocks: userMocks,
  notes: 'Mobile-only modal, captured in a 390×844 phone-size window.',
  viewport: { width: 390, height: 844 },
  render: renderMobileRow,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByText('Breathing problem', {}, { timeout: 10000 }));
  },
});
