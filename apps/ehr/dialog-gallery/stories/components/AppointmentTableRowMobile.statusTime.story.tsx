import { defineStory } from '../../harness/story';
import { forceMobileBreakpoint, renderMobileRow } from './_mobileRow';
import { userMocks } from './_shared';

export default defineStory({
  title: 'Visit status time breakdown (mobile tracking board)',
  source: 'apps/ehr/src/components/AppointmentTableRowMobile.tsx',
  base: 'MUI Modal',
  kind: 'info',
  where: 'Tracking board on a phone-width screen → tap the status timer on a visit row',
  mocks: userMocks,
  notes:
    'Mobile-only modal captured in the 1440px desktop viewport: window.matchMedia is overridden so the real AppointmentTableRow takes its mobile branch. The modal is 80% of the viewport wide, so on a real phone it is much narrower than shown.',
  setup: forceMobileBreakpoint,
  render: renderMobileRow,
  play: async ({ user, screen }) => {
    await user.click((await screen.findAllByText(/\d+m\s*$/, { selector: 'span' }, { timeout: 10000 }))[0]);
  },
});
