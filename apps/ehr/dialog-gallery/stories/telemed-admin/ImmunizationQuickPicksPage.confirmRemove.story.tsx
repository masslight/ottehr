import ImmunizationQuickPicksPage from 'src/features/visits/telemed/components/admin/ImmunizationQuickPicksPage';
import { defineStory } from '../../harness/story';
import { quickPicks } from './_mocks';

export default defineStory({
  title: 'Remove immunization quick pick',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/ImmunizationQuickPicksPage.tsx',
  base: 'AppDialog',
  kind: 'destructive-confirm',
  notes: 'Replaces a native window.confirm() prompt, so there is no "before" screenshot.',
  where: 'Admin → Quick Picks → Immunizations tab → remove (trash) icon on a row',
  mocks: [
    quickPicks([
      {
        id: 'qp-1',
        name: 'Flu shot (adult)',
        vaccine: { id: 'vac-1', name: 'Influenza, injectable, quadrivalent' },
        dose: '0.5',
        units: 'mL',
        cvx: '150',
      },
      {
        id: 'qp-2',
        name: 'Tdap booster',
        vaccine: { id: 'vac-2', name: 'Tdap' },
        dose: '0.5',
        units: 'mL',
        cvx: '115',
      },
    ]),
  ],
  render: () => <ImmunizationQuickPicksPage />,
  play: async ({ user, screen }) => {
    await user.click((await screen.findAllByRole('button', { name: 'Remove' }))[0]);
    await screen.findByRole('dialog');
  },
});
