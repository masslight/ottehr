import { defineStory } from '../../harness/story';
import { visitRoute } from './_fixtures';
import { medicationMocks, pendingOrder, renderCard, SOURCE } from './_medication';

export default defineStory({
  title: 'Save medication as Quick Pick',
  source: SOURCE,
  base: 'MUI Dialog',
  kind: 'form',
  where:
    'In-person visit → In-house Medications → order form → Quick Picks → "+ Add or Update Quick Pick" (admins only)',
  ...visitRoute,
  mocks: medicationMocks(pendingOrder, ['Administrator', 'Provider']),
  render: () => renderCard(pendingOrder, 'order-edit'),
  play: async ({ user, screen, waitFor }) => {
    await user.click(await waitFor(() => screen.getByLabelText('Quick Picks'), { timeout: 15000 }));
    await user.click(await waitFor(() => screen.getByRole('menuitem', { name: /Add or Update Quick Pick/ })));
    await waitFor(() => screen.getByText('Or overwrite an existing quick pick:'), { timeout: 10000 });
  },
  notes: 'Signed-in user mocked as Administrator; three mocked existing quick picks; name is the auto-suggested one.',
});
