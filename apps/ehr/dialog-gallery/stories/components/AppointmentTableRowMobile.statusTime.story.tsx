import { defineStory } from '../../harness/story';
import { renderMobileRow } from './_mobileRow';
import { userMocks } from './_shared';

export default defineStory({
  title: 'Visit status time breakdown (mobile tracking board)',
  source: 'apps/ehr/src/components/AppointmentTableRowMobile.tsx',
  base: 'MUI Modal',
  kind: 'info',
  where: 'Tracking board on a phone-width screen → tap the status timer on a visit row',
  mocks: userMocks,
  notes: 'Mobile-only modal, captured in a 390×844 phone-size window.',
  viewport: { width: 390, height: 844 },
  render: renderMobileRow,
  play: async ({ user, screen }) => {
    await user.click((await screen.findAllByText(/\d+m\s*$/, { selector: 'span' }, { timeout: 10000 }))[0]);
  },
});
